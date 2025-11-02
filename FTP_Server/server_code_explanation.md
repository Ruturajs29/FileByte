# FTP Server Code Explanation

This document provides a comprehensive explanation of the improved FTP server implementation, detailing each component, the networking concepts used, and how the code implements various computer networking principles.

## Table of Contents

1. [Overview](#overview)
2. [Code Structure](#code-structure)
3. [Networking Concepts](#networking-concepts)
4. [Class: ClientHandler](#class-clienthandler)
5. [Class: TCPServer](#class-tcpserver)
6. [Server Initialization](#server-initialization)
7. [Connection Handling](#connection-handling)
8. [Command Processing](#command-processing)
9. [File Transfer Implementation](#file-transfer-implementation)
10. [Error Handling](#error-handling)
11. [Logging and Statistics](#logging-and-statistics)
12. [Signal Handling and Shutdown](#signal-handling-and-shutdown)
13. [Advanced Concepts](#advanced-concepts)

## Overview

The improved TCP server implements a basic FTP (File Transfer Protocol) server using Python's socket programming capabilities. It allows clients to connect and perform operations like listing files, downloading files, uploading files, and deleting files. The server is multithreaded to handle multiple clients simultaneously and includes robust error handling, logging, and statistics tracking.

## Code Structure

The code is organized into two main classes:

1. `ClientHandler`: Manages information about each connected client
2. `TCPServer`: Core server functionality, connection handling, and command processing

Additionally, the code includes:
- Standard FTP response codes
- Logging configuration
- Signal handlers for graceful shutdown
- Thread management for concurrent client connections
- File transfer protocol implementation

## Networking Concepts

### TCP/IP Socket Programming

The server uses TCP (Transmission Control Protocol) sockets to establish reliable, connection-oriented communication with clients. TCP is chosen over UDP (User Datagram Protocol) because:

1. **Connection-oriented**: TCP establishes a connection before data transfer
2. **Reliability**: TCP guarantees delivery of data in the correct order
3. **Flow control**: TCP prevents overwhelming receivers with too much data
4. **Error detection**: TCP ensures data integrity through checksums

```python
# Create socket
self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
```

In this line:
- `socket.AF_INET` specifies IPv4 addressing
- `socket.SOCK_STREAM` specifies TCP protocol

### Socket Options

```python
# Set socket option to reuse address
self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
```

The `SO_REUSEADDR` option allows the server to bind to a port even if it was recently used. This prevents the "Address already in use" error when restarting the server, which occurs due to TIME_WAIT sockets.

### Binding and Listening

```python
# Bind socket to address
self.server_socket.bind((self.host, self.port))
# Listen for connections
self.server_socket.listen(5)
```

- `bind()` associates the socket with a specific network interface and port
- `listen(5)` puts the socket in listening mode with a backlog queue of 5 connection requests
- The backlog parameter (5) limits how many unaccepted connections are allowed before refusing new connections

### Accepting Connections

```python
client_socket, address = self.server_socket.accept()
```

The `accept()` method:
1. Blocks execution until a client connects
2. Returns a new socket object for communication with the client
3. Returns the client's address (IP and port)

### Multithreading for Concurrent Connections

```python
client_thread = threading.Thread(
    target=self.handle_client,
    args=(client_handler,)
)
client_thread.daemon = True
client_thread.start()
```

Each client connection runs in a separate thread to allow:
1. Concurrent handling of multiple clients
2. Independent client operations without blocking other clients
3. Isolation of client errors

Setting `daemon=True` ensures the thread will terminate when the main program exits.

## Class: ClientHandler

The `ClientHandler` class encapsulates all information and operations related to a specific client connection.

### Constructor

```python
def __init__(self, socket, address, server):
    self.socket = socket
    self.address = address
    self.ip = address[0]
    self.port = address[1]
    self.server = server
    self.connected_time = datetime.now()
    self.last_activity = self.connected_time
    self.commands_executed = []
    self.bytes_sent = 0
    self.bytes_received = 0
    self.transfer_in_progress = False
    self.transfer_lock = threading.Lock()
```

This constructor initializes:
- Socket for client communication
- Client address information
- Timestamps for connection monitoring
- Command history
- Data transfer statistics
- Thread synchronization lock

### Key Methods

#### Command Logging and Activity Tracking

```python
def log_command(self, command):
    """Log a command executed by this client"""
    timestamp = datetime.now()
    self.last_activity = timestamp
    self.commands_executed.append((timestamp, command))
```

This method:
1. Records the timestamp of each command
2. Updates last activity time for timeout detection
3. Maintains command history for debugging and statistics

#### Sending Responses

```python
def send_response(self, code_key, additional_text=None):
    """Send a response to the client using standard FTP codes"""
    if code_key not in FTP_CODES:
        code_key = 'CMD_OK'  # Default to OK if code not found
    
    response = FTP_CODES[code_key]
    if additional_text:
        # If the code is already in the response, append the text after a space
        if response[:3] in response:
            response = f"{response} {additional_text}\r\n"
        else:
            response = f"{response}\r\n{additional_text}\r\n"
    else:
        response = f"{response}\r\n"
        
    try:
        self.socket.send(response.encode('utf-8'))
        self.bytes_sent += len(response.encode('utf-8'))
    except Exception as e:
        logging.error(f"Error sending response to {self.get_address_string()}: {str(e)}")
        return False
    return True
```

This method:
1. Formats responses with standard FTP codes
2. Adds additional text when needed
3. Ensures proper formatting with CRLF line endings
4. Handles encoding and transmission errors
5. Updates byte counters for statistics

## Class: TCPServer

The `TCPServer` class is the core component that:
1. Initializes and configures the server socket
2. Accepts and manages client connections
3. Processes client commands
4. Handles file transfers
5. Manages server statistics
6. Implements signal handling for clean shutdown

### Constructor

```python
def __init__(self, host='0.0.0.0', port=8888):
    """Initialize the TCP server with host and port"""
    self.host = host
    self.port = port
    self.server_socket = None
    self.running = False
    self.clients = {}  # Dictionary of client sockets to ClientHandler objects
    self.client_lock = threading.Lock()  # Lock for thread-safe client list operations
    self.working_directory = os.getcwd()
    self.start_time = None
    self.stats = {
        'connections': 0,
        'commands_processed': 0,
        'files_transferred': 0,
        'bytes_sent': 0,
        'bytes_received': 0,
        'errors': 0
    }
    self.stats_lock = threading.Lock()  # Lock for thread-safe stats updates
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, self.signal_handler)
    signal.signal(signal.SIGTERM, self.signal_handler)
```

This constructor:
1. Initializes network parameters (host and port)
2. Sets up client management structures
3. Configures working directory
4. Establishes server statistics tracking
5. Registers signal handlers
6. Creates thread synchronization locks

### Key Methods

#### Starting the Server

```python
def start(self):
    """Start the TCP server"""
    try:
        # Create socket
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # Set socket option to reuse address
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # Set timeout for accept() to allow checking shutdown flag periodically
        self.server_socket.settimeout(1.0)
        # Bind socket to address
        self.server_socket.bind((self.host, self.port))
        # Listen for connections
        self.server_socket.listen(5)
        self.running = True
        self.start_time = datetime.now()
        
        logging.info(f"Server started on {self.host}:{self.port}")
        
        # Print network information
        if self.host == '0.0.0.0':
            logging.info("Server listening on all network interfaces")
            # Try to get local IP addresses for easier connection
            try:
                hostname = socket.gethostname()
                logging.info(f"Hostname: {hostname}")
                # Get all local IP addresses
                local_ips = socket.gethostbyname_ex(hostname)[2]
                logging.info("IP Addresses:")
                for ip in local_ips:
                    logging.info(f"    - {ip}:{self.port}")
            except Exception as e:
                logging.error(f"Could not determine local IP addresses: {e}")
        
        # Start the monitoring thread for checking client timeouts
        monitor_thread = threading.Thread(target=self.monitor_clients)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        # Start accepting connections
        logging.info("Server ready to accept connections")
        self.accept_connections()
            
    except Exception as e:
        logging.error(f"Error starting server: {e}")
        self.stop()
```

This method:
1. Creates and configures the TCP socket
2. Sets a timeout for non-blocking operation
3. Binds to the specified interface and port
4. Starts listening for connections
5. Displays network information
6. Launches a monitoring thread for client management
7. Begins the connection acceptance loop

#### Accepting Connections

```python
def accept_connections(self):
    """Accept client connections in the main thread"""
    while self.running:
        try:
            # Accept connection with timeout
            client_socket, address = self.server_socket.accept()
            
            # Create client handler and add to clients dictionary
            client_handler = ClientHandler(client_socket, address, self)
            
            with self.client_lock:
                self.clients[client_socket] = client_handler
            
            # Increment connection counter
            self.increment_stat('connections')
            
            # Log the connection
            logging.info(f"New connection from {client_handler.get_address_string()}")
            
            # Start a new thread to handle the client
            client_thread = threading.Thread(
                target=self.handle_client,
                args=(client_handler,)
            )
            client_thread.daemon = True
            client_thread.start()
            
        except socket.timeout:
            # This is expected due to the timeout we set - just continue
            continue
        except Exception as e:
            if self.running:  # Only log if we're still meant to be running
                logging.error(f"Error accepting connection: {e}")
```

This method:
1. Runs a loop to accept incoming connections
2. Uses a timeout to periodically check if the server should stop
3. Creates a ClientHandler object for each new connection
4. Updates connection statistics
5. Logs new connections
6. Launches a dedicated thread for each client
7. Uses error handling to manage connection failures

#### Handling Client Connections

```python
def handle_client(self, client):
    """Handle client connection"""
    try:
        # Send welcome message
        client.send_response('READY', "FTP Server Ready")
        
        while self.running:
            # Receive data
            try:
                data = client.socket.recv(1024)
            except ConnectionResetError:
                logging.info(f"Connection reset by {client.get_address_string()}")
                break
            except Exception as e:
                logging.error(f"Error receiving data from {client.get_address_string()}: {e}")
                break
                
            if not data:
                logging.info(f"Client {client.get_address_string()} disconnected")
                break
            
            # Process the command
            command_str = data.decode('utf-8').strip()
            logging.info(f"Received from {client.get_address_string()}: {command_str}")
            client.log_command(command_str)
            
            # Increment command counter
            self.increment_stat('commands_processed')
            
            # Parse the command
            parts = command_str.strip().split()
            if not parts:
                client.send_response('SYNTAX_ERROR')
                continue
            
            command = parts[0].upper()
            args = parts[1:] if len(parts) > 1 else []
            
            # Handle special commands that require custom data transfer
            if command == "GET" and len(args) > 0:
                self.handle_get(client, args[0])
            elif command == "PUT" and len(args) > 0:
                self.handle_put(client, args[0])
            else:
                # Regular commands that just need a response
                self.process_command(client, command_str)
            
            # Check if command was QUIT
            if command == 'QUIT':
                break
            
    except Exception as e:
        logging.error(f"Error handling client {client.get_address_string()}: {e}")
        self.increment_stat('errors')
    finally:
        # Remove client from list and close socket
        with self.client_lock:
            if client.socket in self.clients:
                del self.clients[client.socket]
        
        try:
            client.socket.close()
        except:
            pass
            
        logging.info(f"Connection closed with {client.get_address_string()}")
```

This method:
1. Sends a welcome message to the client
2. Enters a loop to receive and process client commands
3. Handles connection resets and errors
4. Parses and logs commands
5. Updates command statistics
6. Routes special commands (GET/PUT) to specific handlers
7. Processes standard commands
8. Cleans up resources when the connection ends

## Server Initialization

The server initialization occurs at the end of the file:

```python
if __name__ == "__main__":
    # Default values
    host = '0.0.0.0'  # Listen on all interfaces
    port = 8888
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        host = sys.argv[1]
    if len(sys.argv) > 2:
        try:
            port = int(sys.argv[2])
        except ValueError:
            logging.error(f"Invalid port number: {sys.argv[2]}")
            sys.exit(1)
    
    # Create and start server
    server = TCPServer(host, port)
    server.start()
```

This code:
1. Sets default host and port values
2. Parses command-line arguments to override defaults
3. Creates a TCPServer instance
4. Starts the server

The default host `0.0.0.0` tells the server to listen on all network interfaces, making it accessible from both local and remote clients.

## Connection Handling

### Client Monitoring

```python
def monitor_clients(self):
    """Monitor clients for timeouts and other health checks"""
    while self.running:
        try:
            # Check each client's status
            with self.client_lock:
                # Make a copy of the keys to avoid modification during iteration
                clients_to_check = list(self.clients.keys())
            
            for client_socket in clients_to_check:
                with self.client_lock:
                    if client_socket not in self.clients:
                        continue  # Client was removed
                    
                    client = self.clients[client_socket]
                
                # Check if client has been idle too long (e.g., 5 minutes)
                idle_time = client.get_idle_time()
                if idle_time.total_seconds() > 300:  # 5 minutes
                    if not client.transfer_in_progress:  # Don't disconnect during transfer
                        logging.info(f"Client {client.get_address_string()} timed out after {idle_time}")
                        
                        try:
                            # Send timeout message
                            client.send_response('GOODBYE', "Connection timed out due to inactivity")
                            # Close socket
                            client_socket.close()
                        except:
                            pass
                        
                        # Remove client from list
                        with self.client_lock:
                            if client_socket in self.clients:
                                del self.clients[client_socket]
            
            # Sleep for a bit before checking again
            time.sleep(10)
            
        except Exception as e:
            logging.error(f"Error in client monitor: {e}")
```

This method:
1. Runs in a dedicated thread to monitor client connections
2. Checks for idle clients that have exceeded timeout limits
3. Avoids disconnecting clients during active file transfers
4. Uses thread-safe operations with locks when accessing shared data
5. Implements resource cleanup for timed-out connections

## Command Processing

```python
def process_command(self, client, command_str):
    """Process the client command and send a response"""
    # Split the command into parts
    parts = command_str.strip().split()
    if not parts:
        client.send_response('SYNTAX_ERROR')
        return
    
    command = parts[0].upper()
    args = parts[1:] if len(parts) > 1 else []
    
    # Process based on command
    if command == "LIST":
        self.handle_list(client)
    elif command == "GET":
        # GET is handled separately in handle_client
        if not args:
            client.send_response('SYNTAX_ERROR_PARAM', "Filename required")
        else:
            client.send_response('BAD_SEQUENCE', "GET should be handled separately")
    elif command == "PUT":
        # PUT is handled separately in handle_client
        if not args:
            client.send_response('SYNTAX_ERROR_PARAM', "Filename required")
        else:
            client.send_response('BAD_SEQUENCE', "PUT should be handled separately")
    elif command == "DEL":
        if not args:
            client.send_response('SYNTAX_ERROR_PARAM', "Filename required")
        else:
            self.handle_delete(client, args[0])
    elif command == "STAT":
        self.handle_stat(client)
    elif command == "SYST":
        # Report server system type
        client.send_response('CMD_OK', f"Python FTP Server ({sys.platform})")
    elif command == "QUIT":
        client.send_response('GOODBYE')
    else:
        client.send_response('NOT_IMPLEMENTED', f"Command '{command}' not implemented")
```

This method:
1. Parses the command string into a command and arguments
2. Routes each command to the appropriate handler method
3. Validates command arguments
4. Sends appropriate error responses for invalid commands
5. Handles standard FTP commands (LIST, DEL, STAT, SYST, QUIT)

### Command: LIST

```python
def handle_list(self, client):
    """Handle LIST command - list files in working directory"""
    try:
        # Update activity time
        client.update_activity()
        
        files = os.listdir(self.working_directory)
        if not files:
            client.send_response('CMD_OK', "No files in directory")
            return
        
        # Build a response with file details
        response = ""
        for file in files:
            file_path = os.path.join(self.working_directory, file)
            try:
                # Get file info
                stat_info = os.stat(file_path)
                # Format the date
                date_str = datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                # Check if it's a directory
                file_type = 'DIR' if os.path.isdir(file_path) else 'FILE'
                # Format file size
                size_str = f"{stat_info.st_size:,} bytes"
                
                response += f"{file_type:<6} {size_str:<15} {date_str} {file}\r\n"
            except Exception as e:
                # Skip files that can't be accessed
                logging.warning(f"Error accessing file {file}: {e}")
        
        client.send_response('CMD_OK', response)
        
    except Exception as e:
        logging.error(f"Error handling LIST command: {e}")
        client.send_response('LOCAL_ERROR', f"Error: {str(e)}")
        self.increment_stat('errors')
```

This method:
1. Updates the client's activity timestamp to prevent timeout
2. Gets a directory listing from the OS
3. Formats each file's details (type, size, date, name)
4. Skips files that can't be accessed
5. Sends a formatted response with the file listing
6. Handles and logs any errors that occur

## File Transfer Implementation

### File Download (GET)

```python
def handle_get(self, client, filename):
    """Handle GET command - send file to client in chunks"""
    # Set transfer flag to prevent timeout disconnection
    with client.transfer_lock:
        client.transfer_in_progress = True
    
    try:
        # Update activity time
        client.update_activity()
        
        file_path = os.path.join(self.working_directory, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            client.send_response('FILE_UNAVAILABLE', f"File not found: {filename}")
            return
        
        # Check if it's a directory
        if os.path.isdir(file_path):
            client.send_response('FILE_UNAVAILABLE', f"{filename} is a directory, not a file")
            return
        
        try:
            # Get file size and prepare for transfer
            file_size = os.path.getsize(file_path)
            
            # Send initial response with file info
            client.send_response('ENTERING_TRANSFER', f"File: {filename}\r\nSize: {file_size} bytes")
            
            # Send file marker to indicate start of binary data
            client.socket.send(b"FILE_START\r\n")
            client.bytes_sent += len(b"FILE_START\r\n")
            self.increment_stat('bytes_sent', len(b"FILE_START\r\n"))
            
            # Send file data in chunks
            bytes_sent = 0
            with open(file_path, 'rb') as file:
                chunk = file.read(8192)  # Read 8KB at a time
                while chunk and self.running:
                    client.socket.send(chunk)
                    bytes_sent += len(chunk)
                    client.bytes_sent += len(chunk)
                    self.increment_stat('bytes_sent', len(chunk))
                    chunk = file.read(8192)
                    
                    # Update activity time periodically
                    if bytes_sent % (1024*1024) == 0:  # Update every 1MB
                        client.update_activity()
            
            # Send file marker to indicate end of binary data
            client.socket.send(b"FILE_END\r\n")
            client.bytes_sent += len(b"FILE_END\r\n")
            self.increment_stat('bytes_sent', len(b"FILE_END\r\n"))
            
            # Increment file transfer counter
            self.increment_stat('files_transferred')
            
            logging.info(f"File {filename} sent successfully to {client.get_address_string()}, {bytes_sent} bytes")
            
        except Exception as e:
            # Send error response if something goes wrong
            logging.error(f"Error sending file {filename} to {client.get_address_string()}: {e}")
            client.send_response('LOCAL_ERROR', f"Error sending file: {str(e)}")
            self.increment_stat('errors')
            
    except Exception as e:
        logging.error(f"Error handling GET command: {e}")
        client.send_response('LOCAL_ERROR', f"Error: {str(e)}")
        self.increment_stat('errors')
    finally:
        # Clear transfer flag
        with client.transfer_lock:
            client.transfer_in_progress = False
```

This method implements file download using these steps:

1. **Transfer Protection**: Sets a flag to prevent timeout disconnection during transfer
2. **File Validation**:
   - Checks if the file exists
   - Ensures it's not a directory
3. **Transfer Initialization**:
   - Gets the file size
   - Sends response with file information
   - Sends a file marker to indicate start of binary data
4. **Chunked Transfer**:
   - Opens the file in binary mode
   - Reads and sends the file in 8KB chunks
   - Updates activity time periodically
   - Updates byte counters for statistics
5. **Transfer Completion**:
   - Sends an end marker to indicate end of binary data
   - Updates statistics
   - Logs transfer completion
6. **Error Handling**:
   - Catches and logs exceptions
   - Sends error responses to the client
7. **Resource Cleanup**:
   - Clears the transfer flag when done

### File Upload (PUT)

```python
def handle_put(self, client, filename):
    """Handle PUT command - receive file from client and save it"""
    # Set transfer flag to prevent timeout disconnection
    with client.transfer_lock:
        client.transfer_in_progress = True
        
    try:
        # Update activity time
        client.update_activity()
        
        file_path = os.path.join(self.working_directory, filename)
        
        # Check if file already exists
        if os.path.exists(file_path):
            client.send_response('FILE_UNAVAILABLE', f"File already exists: {filename}")
            return
        
        # Create a temporary file first to avoid incomplete transfers
        temp_file_path = f"{file_path}.part"
        
        # Send ready response
        client.send_response('ENTERING_TRANSFER', f"Ready to receive file: {filename}")
        
        try:
            # Send ready marker
            client.socket.send(b"READY_FOR_FILE\r\n")
            client.bytes_sent += len(b"READY_FOR_FILE\r\n")
            self.increment_stat('bytes_sent', len(b"READY_FOR_FILE\r\n"))
            
            # Receive file data in chunks
            file_started = False
            file_ended = False
            bytes_received = 0
            
            with open(temp_file_path, 'wb') as file:
                while self.running and not file_ended:
                    try:
                        chunk = client.socket.recv(8192)  # 8KB chunks
                        if not chunk:  # Connection closed
                            break
                            
                        client.bytes_received += len(chunk)
                        self.increment_stat('bytes_received', len(chunk))
                        
                        # Update activity time periodically
                        bytes_received += len(chunk)
                        if bytes_received % (1024*1024) == 0:  # Update every 1MB
                            client.update_activity()
                        
                        # Look for start marker if we haven't found it yet
                        if not file_started:
                            if b"FILE_START\r\n" in chunk:
                                # Remove marker and keep everything after it
                                chunk = chunk.split(b"FILE_START\r\n", 1)[1]
                                file_started = True
                            else:
                                # Still waiting for start marker
                                continue
                        
                        # Check for end marker
                        if b"FILE_END\r\n" in chunk:
                            # Remove end marker and keep everything before it
                            chunk = chunk.split(b"FILE_END\r\n", 1)[0]
                            file.write(chunk)
                            file_ended = True
                            break
                        else:
                            # Write the chunk to file
                            file.write(chunk)
                    
                    except socket.timeout:
                        # Socket timeout - just continue
                        continue
                    except Exception as e:
                        logging.error(f"Error receiving chunk from {client.get_address_string()}: {e}")
                        raise
            
            # Check if we got a complete file
            if file_started and file_ended:
                # Rename temporary file to final name
                os.rename(temp_file_path, file_path)
                
                # Increment file transfer counter
                self.increment_stat('files_transferred')
                
                client.send_response('FILE_STATUS_OK', f"File {filename} received and saved successfully")
                logging.info(f"File {filename} received successfully from {client.get_address_string()}, {bytes_received} bytes")
            else:
                # Clean up incomplete file
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                
                client.send_response('LOCAL_ERROR', "File transfer interrupted or incomplete")
                logging.warning(f"Incomplete file transfer from {client.get_address_string()}: {filename}")
                
        except Exception as e:
            # Clean up temporary file if it exists
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            
            # Send error response
            logging.error(f"Error receiving file {filename} from {client.get_address_string()}: {e}")
            client.send_response('LOCAL_ERROR', f"Error receiving file: {str(e)}")
            self.increment_stat('errors')
            
    except Exception as e:
        logging.error(f"Error handling PUT command: {e}")
        client.send_response('LOCAL_ERROR', f"Error: {str(e)}")
        self.increment_stat('errors')
    finally:
        # Clear transfer flag
        with client.transfer_lock:
            client.transfer_in_progress = False
```

The file upload implementation includes these key concepts:

1. **Atomic File Operations**:
   - Uses a temporary file (.part extension)
   - Only renames to final name when transfer is complete
   - Prevents partial/corrupted files

2. **Transfer Protocol**:
   - Uses marker strings to identify start and end of binary data
   - Handles mixed text/binary communication
   - Implements a simple framing protocol

3. **Chunked Receiving**:
   - Processes data in 8KB chunks
   - Scans for protocol markers
   - Handles partial frames

4. **Error Recovery**:
   - Cleans up temporary files on error
   - Detects and reports incomplete transfers
   - Uses try-except blocks for robust error handling

## Error Handling

The server implements comprehensive error handling at multiple levels:

1. **Socket-level Errors**:
   - Connection resets
   - Timeouts
   - Disconnections

2. **File Operation Errors**:
   - File not found
   - Permission denied
   - Disk full

3. **Protocol Errors**:
   - Syntax errors
   - Invalid parameters
   - Sequence errors

4. **System Errors**:
   - Resource allocation failures
   - OS-level exceptions

Error handling strategy:

1. **Catch and Log**: All exceptions are caught, logged, and tracked in statistics
2. **Respond to Client**: Appropriate error codes are sent to the client
3. **Resource Cleanup**: All resources are properly cleaned up, even on error paths
4. **Isolation**: Client errors are isolated and don't affect other clients

## Logging and Statistics

### Logging Configuration

```python
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ftp_server.log"),
        logging.StreamHandler()
    ]
)
```

The logging system:
1. Writes to both console and file
2. Includes timestamps and log levels
3. Captures important events for debugging

### Statistics Tracking

```python
self.stats = {
    'connections': 0,
    'commands_processed': 0,
    'files_transferred': 0,
    'bytes_sent': 0,
    'bytes_received': 0,
    'errors': 0
}
```

The server maintains statistics for:
1. Connection count
2. Command count
3. File transfer count
4. Data volume (bytes sent/received)
5. Error count

These statistics are:
- Updated in a thread-safe manner
- Available through the STAT command
- Logged when the server shuts down

## Signal Handling and Shutdown

```python
def signal_handler(self, sig, frame):
    """Handle termination signals"""
    logging.info(f"Received signal {sig}, shutting down...")
    self.stop()
```

Signal handling enables:
1. Clean shutdown on Ctrl+C (SIGINT)
2. Graceful termination on system shutdown (SIGTERM)

The shutdown process:

```python
def stop(self):
    """Stop the TCP server safely"""
    if not self.running:
        return  # Already stopped
        
    logging.info("Shutting down server...")
    self.running = False
    
    # Give a moment for threads to notice the running flag change
    time.sleep(0.5)
    
    # Notify all clients about shutdown
    with self.client_lock:
        clients_to_close = list(self.clients.values())
    
    for client in clients_to_close:
        try:
            client.send_response('GOODBYE', "Server shutting down")
            client.socket.close()
        except:
            pass
    
    # Close server socket
    if self.server_socket:
        try:
            self.server_socket.close()
        except:
            pass
    
    # Log final statistics
    uptime = datetime.now() - self.start_time
    days, remainder = divmod(uptime.total_seconds(), 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{int(days)}d {int(hours)}h {int(minutes)}m {int(seconds)}s"
    
    with self.stats_lock:
        logging.info(f"Server statistics:")
        logging.info(f"  Uptime: {uptime_str}")
        logging.info(f"  Connections: {self.stats['connections']}")
        logging.info(f"  Commands processed: {self.stats['commands_processed']}")
        logging.info(f"  Files transferred: {self.stats['files_transferred']}")
        logging.info(f"  Bytes sent: {self.stats['bytes_sent']:,}")
        logging.info(f"  Bytes received: {self.stats['bytes_received']:,}")
        logging.info(f"  Errors: {self.stats['errors']}")
        
    logging.info("Server stopped")
```

The shutdown process:
1. Sets a flag to stop all threads
2. Notifies all clients about the shutdown
3. Closes client connections
4. Closes the server socket
5. Logs final statistics and shutdown message

## Advanced Concepts

### Thread Safety and Synchronization

The server uses locks to ensure thread-safe access to shared resources:

```python
self.client_lock = threading.Lock()  # Lock for thread-safe client list operations
self.stats_lock = threading.Lock()  # Lock for thread-safe stats updates
```

These locks prevent race conditions when:
1. Adding or removing clients from the clients dictionary
2. Updating statistics counters

Example of thread-safe operation:

```python
def increment_stat(self, stat_name, value=1):
    """Thread-safe increment of a stat counter"""
    with self.stats_lock:
        if stat_name in self.stats:
            self.stats[stat_name] += value
```

### Non-blocking Socket Operations

```python
self.server_socket.settimeout(1.0)
```

Setting a timeout on the server socket enables:
1. Non-blocking accept() calls that return periodically
2. Checking the running flag to allow clean shutdown
3. Preventing the server from being stuck in accept() during shutdown

### Client Timeout Detection

```python
idle_time = client.get_idle_time()
if idle_time.total_seconds() > 300:  # 5 minutes
    if not client.transfer_in_progress:  # Don't disconnect during transfer
        # Disconnect idle client
```

This mechanism:
1. Tracks client activity time
2. Disconnects idle clients after a timeout
3. Preserves clients during active transfers
4. Frees server resources from abandoned connections

### Protocol Design

The server implements a simple application protocol with:

1. **Command Format**: Simple text commands with space-separated arguments
2. **Response Codes**: Standard numeric codes with text descriptions
3. **Framing**: Special markers for binary data boundaries
4. **Status Updates**: Response codes indicate success or failure

This protocol design follows principles similar to standard FTP, but with simplified syntax and fewer commands.

### File Transfer Protocol

The file transfer protocol uses these elements:

1. **Markers**: `FILE_START\r\n` and `FILE_END\r\n` to frame binary data
2. **Ready Signals**: `READY_FOR_FILE\r\n` to synchronize upload operations
3. **Chunking**: 8KB chunks for efficient memory usage
4. **Status Codes**: Standard response codes for transfer outcomes

### Socket Lifecycle Management

The server properly manages the socket lifecycle:
1. **Creation**: socket() creates the socket object
2. **Configuration**: setsockopt() sets socket options
3. **Binding**: bind() associates the socket with an address
4. **Listening**: listen() makes the socket listen for connections
5. **Accepting**: accept() creates new sockets for clients
6. **Reading/Writing**: send()/recv() for data transfer
7. **Closing**: close() releases socket resources

### Resource Cleanup

The server ensures proper resource cleanup:
1. **Socket Closing**: All sockets are closed when no longer needed
2. **File Handles**: All files are closed after use
3. **Temporary Files**: Partial uploads are deleted
4. **Client Objects**: Removed from tracking when disconnected
5. **Exception Handling**: finally blocks ensure cleanup even on error