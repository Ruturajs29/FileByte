# FTP Client Code Explanation

This document provides a detailed explanation of the improved FTP client implementation, exploring each component, the networking concepts used, and how the code implements various computer networking principles.

## Table of Contents

1. [Overview](#overview)
2. [Code Structure](#code-structure)
3. [Networking Concepts](#networking-concepts)
4. [Class: TCPClient](#class-tcpclient)
5. [Client Initialization](#client-initialization)
6. [Connection Handling](#connection-handling)
7. [Command Processing](#command-processing)
8. [File Transfer Implementation](#file-transfer-implementation)
9. [Error Handling](#error-handling)
10. [User Interface](#user-interface)
11. [Signal Handling and Shutdown](#signal-handling-and-shutdown)
12. [Advanced Concepts](#advanced-concepts)

## Overview

The improved TCP client implements a feature-rich FTP (File Transfer Protocol) client using Python's socket programming capabilities. It connects to an FTP server to perform operations like listing files, downloading files, uploading files, and deleting files. The client includes robust error handling, progress tracking, colorful output formatting, and support for local file operations.

## Code Structure

The code is organized around the `TCPClient` class that encapsulates all client functionality, including:

1. Connection management
2. Command sending and response handling
3. File transfer (upload and download)
4. Local file operations
5. User interaction
6. Error handling and recovery
7. Statistics tracking

The code also includes:
- Logging configuration
- ANSI color formatting for terminal output
- Signal handling for clean termination
- Session statistics tracking

## Networking Concepts

### TCP/IP Socket Programming

The client uses TCP (Transmission Control Protocol) sockets to establish reliable, connection-oriented communication with the server:

```python
# Create socket
self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
```

In this line:
- `socket.AF_INET` specifies IPv4 addressing
- `socket.SOCK_STREAM` specifies TCP protocol

TCP is chosen for these key benefits:
1. **Reliability**: Guarantees data delivery without corruption or duplication
2. **Ordered delivery**: Ensures data arrives in the same order it was sent
3. **Connection management**: Handles setup and teardown of connections
4. **Error detection**: Validates data integrity through checksums

### Socket Timeout

```python
# Set timeout for operations to allow for clean interrupt
self.client_socket.settimeout(60.0)  # 60 second timeout
```

Socket timeouts:
1. Prevent the client from hanging indefinitely on network operations
2. Allow the client to detect and recover from slow or unresponsive servers
3. Enable clean interrupt handling during file transfers
4. Provide a mechanism to detect network problems

### Establishing a Connection

```python
# Connect to server
print(f"Connecting to {self.host}:{self.port}...")
self.client_socket.connect((self.host, self.port))
```

The `connect()` operation:
1. Initiates the TCP three-way handshake with the server
2. Blocks until the connection is established or fails
3. Raises exceptions for connection problems (refused, timeout, etc.)

### Threads for Concurrent Operations

```python
# Start listening for incoming messages in a separate thread
receive_thread = threading.Thread(target=self.receive_messages)
receive_thread.daemon = True
receive_thread.start()
```

This threading model enables:
1. Concurrent sending and receiving of data
2. Responsive user interface during network operations
3. Background processing of server responses
4. File transfer progress tracking

Setting `daemon=True` ensures the thread terminates when the main program exits.

## Class: TCPClient

The `TCPClient` class encapsulates all functionality needed to interact with the FTP server.

### Constructor

```python
def __init__(self, host='localhost', port=8888):
    """Initialize the TCP client with host and port"""
    self.host = host
    self.port = port
    self.client_socket = None
    self.running = False
    self.file_transfer_mode = False
    self.file_transfer_data = bytearray()
    self.file_transfer_complete = threading.Event()
    self.last_activity = time.time()
    self.stats = {
        'commands_sent': 0,
        'files_transferred': 0,
        'bytes_sent': 0,
        'bytes_received': 0,
        'errors': 0
    }
    
    # Available commands help
    self.available_commands = {
        "LIST": "List files in the server directory",
        "GET <filename>": "Download a file from the server",
        "PUT <filename>": "Upload a file from your local directory to the server",
        "DEL <filename>": "Delete a file on the server",
        "STAT": "Show server statistics",
        "SYST": "Show server system information",
        "QUIT": "Close the connection",
        "HELP": "Show this help message"
    }
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, self.signal_handler)
```

This constructor initializes:
- Network connection parameters
- Runtime flags and state variables
- Data structures for file transfers
- Statistics tracking
- Command help information
- Signal handlers

### Key Methods

#### Connecting to the Server

```python
def connect(self):
    """Connect to the server"""
    try:
        # Create socket
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # Set timeout for operations to allow for clean interrupt
        self.client_socket.settimeout(60.0)  # 60 second timeout
        
        # Connect to server
        print(f"Connecting to {self.host}:{self.port}...")
        self.client_socket.connect((self.host, self.port))
        self.running = True
        
        logging.info(f"Connected to {self.host}:{self.port}")
        print(f"{Colors.GREEN}[*] Connected to {self.host}:{self.port}{Colors.RESET}")
        
        self.update_activity()
        
        # Start listening for incoming messages in a separate thread
        receive_thread = threading.Thread(target=self.receive_messages)
        receive_thread.daemon = True
        receive_thread.start()
        
        # Print initial help
        self.print_help()
        
        # Start sending commands
        while self.running:
            # Command processing loop
            # ...
```

This method:
1. Creates and configures the socket
2. Establishes a connection to the server
3. Sets up a thread for receiving responses
4. Displays help information
5. Enters the main command loop

## Client Initialization

The client initialization occurs at the end of the file:

```python
if __name__ == "__main__":
    # Default values
    host = 'localhost'
    port = 8888
    
    print(f"\n{Colors.BOLD}{Colors.PURPLE}=== Enhanced FTP Client ==={Colors.RESET}")
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        host = sys.argv[1]
    if len(sys.argv) > 2:
        try:
            port = int(sys.argv[2])
        except ValueError:
            logging.error(f"Invalid port number: {sys.argv[2]}")
            print(f"{Colors.RED}[!] Invalid port number: {sys.argv[2]}{Colors.RESET}")
            sys.exit(1)
    
    # Create and connect client
    client = TCPClient(host, port)
    client.connect()
```

This code:
1. Sets default host and port values
2. Parses command-line arguments to override defaults
3. Creates a TCPClient instance
4. Initiates the connection to the server

## Connection Handling

### Main Command Loop

```python
# Start sending commands
while self.running:
    try:
        # Get user input
        command = input(f"\n{Colors.BOLD}{Colors.CYAN}FTP> {Colors.RESET}")
        
        if not command.strip():
            continue
            
        self.update_activity()
        
        # Check for help command
        if command.lower() == 'help':
            self.print_help()
            continue
        
        # Check if user wants to quit using client-side command
        if command.lower() == 'exit':
            # Send QUIT command to server first
            self.client_socket.send("QUIT".encode('utf-8'))
            self.increment_stat('commands_sent')
            self.increment_stat('bytes_sent', len("QUIT".encode('utf-8')))
            time.sleep(0.5)  # Wait for server response
            self.disconnect()
            break
        
        # Parse command
        parts = command.strip().split()
        if not parts:
            continue
        
        cmd = parts[0].upper()
        args = parts[1:] if len(parts) > 1 else []
        
        # Local commands
        if cmd == "LOCAL_LS":
            self.handle_local_ls()
            continue
        elif cmd == "LOCAL_CD" and args:
            self.handle_local_cd(args[0])
            continue
        elif cmd == "LOCAL_PWD":
            self.handle_local_pwd()
            continue
        
        # Special handling for PUT command
        if cmd == "PUT" and args:
            self.handle_put_command(command, args[0])
        else:
            # Send regular command to server
            self.client_socket.send(command.encode('utf-8'))
            self.increment_stat('commands_sent')
            self.increment_stat('bytes_sent', len(command.encode('utf-8')))
            
            # If command is GET, wait for file transfer
            if cmd == "GET" and args:
                # File transfer will be handled by the receive_messages thread
                # Wait a bit to ensure response starts coming
                time.sleep(0.1)
            
            # If command is QUIT, disconnect after server response
            if cmd == 'QUIT':
                time.sleep(0.5)  # Wait for server response
                self.disconnect()
                break
```

This loop:
1. Gets user commands from the terminal
2. Processes special client commands (HELP, EXIT, LOCAL_*)
3. Handles file upload commands specially
4. Sends regular commands to the server
5. Manages command-specific behavior (GET, QUIT)

### Response Handling Thread

```python
def receive_messages(self):
    """Receive messages from the server"""
    current_file = None
    file_download = False
    file_name = None
    file_size = 0
    bytes_received = 0
    download_start_time = None
    
    while self.running:
        try:
            # Receive data
            data = self.client_socket.recv(8192)  # 8KB buffer
            if not data:
                logging.info("Server disconnected")
                print(f"{Colors.YELLOW}[!] Server disconnected{Colors.RESET}")
                self.disconnect()
                break
```

This thread:
1. Runs continuously in the background
2. Receives and processes server responses
3. Handles disconnections
4. Detects and processes file transfers
5. Updates the user interface with status information

## Command Processing

### Local Commands

```python
def handle_local_ls(self):
    """List files in the local directory"""
    try:
        files = os.listdir('.')
        if not files:
            print("\nNo files in local directory")
            return
            
        print("\n=== Local Directory Contents ===")
        for file in files:
            file_path = os.path.join('.', file)
            try:
                # Get file info
                stat_info = os.stat(file_path)
                # Format the date
                date_str = datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                # Check if it's a directory
                file_type = 'DIR' if os.path.isdir(file_path) else 'FILE'
                # Format file size
                size_str = f"{stat_info.st_size:,} bytes"
                
                if file_type == 'DIR':
                    print(f"{Colors.BLUE}{file_type:<6} {size_str:<15} {date_str} {file}{Colors.RESET}")
                else:
                    print(f"{file_type:<6} {size_str:<15} {date_str} {file}")
            except Exception as e:
                print(f"Error accessing {file}: {e}")
    except Exception as e:
        print(f"{Colors.RED}[!] Error listing local directory: {str(e)}{Colors.RESET}")
```

The client includes several local commands that don't require server interaction:

1. **LOCAL_LS**: Lists files in the local directory
2. **LOCAL_CD**: Changes the local working directory
3. **LOCAL_PWD**: Prints the current local directory

These commands enhance usability by allowing the user to navigate their local file system while staying within the FTP client interface.

## File Transfer Implementation

### File Upload (PUT)

```python
def handle_put_command(self, command, filename):
    """Handle PUT command - upload file to server"""
    # Check if file exists locally
    if not os.path.exists(filename):
        print(f"{Colors.RED}\n[!] Local file not found: {filename}{Colors.RESET}")
        return
    
    # Check if it's a directory
    if os.path.isdir(filename):
        print(f"{Colors.RED}\n[!] {filename} is a directory, not a file{Colors.RESET}")
        return
    
    try:
        # Send the PUT command
        self.client_socket.send(command.encode('utf-8'))
        self.increment_stat('commands_sent')
        self.increment_stat('bytes_sent', len(command.encode('utf-8')))
        
        # Wait for server response (should be 200 OK or error)
        # The receive_messages thread will handle the initial response
        time.sleep(0.5)
        
        # Look for READY_FOR_FILE marker from server
        ready = False
        max_wait = 10  # Maximum wait time in seconds
        start_time = time.time()
        
        while not ready and time.time() - start_time < max_wait:
            if self.file_transfer_mode and "READY_FOR_FILE" in str(self.file_transfer_data):
                ready = True
                break
            time.sleep(0.1)
        
        if not ready:
            print(f"{Colors.RED}\n[!] Server not ready to receive file, timeout{Colors.RESET}")
            return
        
        # Reset file transfer data
        self.file_transfer_data = bytearray()
        self.file_transfer_mode = False
        
        # Send file start marker
        self.client_socket.send(b"FILE_START\r\n")
        self.increment_stat('bytes_sent', len(b"FILE_START\r\n"))
        
        # Send file in chunks
        file_size = os.path.getsize(filename)
        bytes_sent = 0
        
        with open(filename, 'rb') as file:
            # Display progress bar setup
            print(f"\n{Colors.CYAN}[*] Uploading {filename} ({file_size:,} bytes){Colors.RESET}")
            print("[", end="", flush=True)
            
            chunk = file.read(8192)  # 8KB chunks
            while chunk:
                self.client_socket.send(chunk)
                bytes_sent += len(chunk)
                self.increment_stat('bytes_sent', len(chunk))
                
                # Update progress bar
                progress = int(50 * bytes_sent / file_size) if file_size > 0 else 50
                print("=" * (progress - (bytes_sent > 0)), end="", flush=True)
                
                chunk = file.read(8192)
            
            print(f"] 100%")
        
        # Send file end marker
        self.client_socket.send(b"FILE_END\r\n")
        self.increment_stat('bytes_sent', len(b"FILE_END\r\n"))
        self.increment_stat('files_transferred')
        
        print(f"{Colors.GREEN}\n[*] File upload complete: {bytes_sent:,} bytes sent{Colors.RESET}")
```

This method implements file upload using these steps:

1. **Local File Validation**:
   - Checks if the file exists
   - Ensures it's not a directory
   
2. **Command Communication**:
   - Sends the PUT command to the server
   - Waits for server acknowledgment
   
3. **Protocol Synchronization**:
   - Waits for "READY_FOR_FILE" marker from server
   - Implements timeout to prevent hanging
   
4. **Transfer Initialization**:
   - Sends file start marker
   - Prepares progress tracking
   
5. **Chunked Transfer**:
   - Opens the file in binary mode
   - Reads and sends the file in 8KB chunks
   - Updates progress bar in real-time
   
6. **Transfer Completion**:
   - Sends end marker
   - Updates statistics
   - Displays transfer summary

### File Download (GET)

File download is handled in the `receive_messages` method, with these key components:

```python
# Check for file transfer start marker for GET command
if b"FILE_START" in data and not file_download:
    file_download = True
    download_start_time = time.time()
    # Extract the filename from the previous server response
    response_text = data.decode('utf-8', errors='ignore')
    lines = response_text.split('\r\n')
    
    # Find the filename
    for line in lines:
        if line.startswith("File:"):
            file_name = line.split(":", 1)[1].strip()
        elif line.startswith("Size:"):
            try:
                size_text = line.split(":", 1)[1].strip()
                file_size = int(size_text.split()[0].replace(',', ''))
            except:
                file_size = 0
    
    if not file_name:
        file_name = "downloaded_file_" + time.strftime("%Y%m%d%H%M%S")
    
    # Use a .part extension during download
    temp_file_name = f"{file_name}.part"
    
    print(f"\n{Colors.CYAN}[*] Receiving file: {file_name} ({file_size:,} bytes){Colors.RESET}")
    print("[", end="", flush=True)
    
    # Open file for writing
    try:
        current_file = open(temp_file_name, 'wb')
        bytes_received = 0
    except Exception as e:
        logging.error(f"Error opening file for writing: {str(e)}")
        print(f"{Colors.RED}[!] Error opening file for writing: {str(e)}{Colors.RESET}")
        file_download = False
        continue
```

The file download implementation includes:

1. **Transfer Detection**:
   - Identifies file transfer start markers in the data stream
   - Parses metadata (filename, size) from server responses
   
2. **Temporary File Approach**:
   - Uses a .part extension during download
   - Prevents partial/corrupted files
   
3. **Progress Tracking**:
   - Displays a progress bar
   - Shows file size and completion percentage
   
4. **Chunked Receiving**:
   - Processes data in 8KB chunks
   - Scans for protocol markers
   - Writes data to disk incrementally
   
5. **Transfer Completion**:
   - Detects end marker
   - Renames from temporary to final filename
   - Calculates and displays transfer statistics

## Error Handling

The client implements comprehensive error handling at multiple levels:

### Connection Errors

```python
except ConnectionRefusedError:
    logging.error(f"Connection refused: {self.host}:{self.port}")
    print(f"{Colors.RED}[!] Connection refused: {self.host}:{self.port}")
    print("[!] Make sure the server is running and the address is correct{Colors.RESET}")
except socket.gaierror:
    logging.error(f"Address resolution failed for: {self.host}")
    print(f"{Colors.RED}[!] Could not resolve hostname: {self.host}")
    print("[!] Check your network connection and the hostname{Colors.RESET}")
except socket.timeout:
    logging.error(f"Connection attempt timed out: {self.host}:{self.port}")
    print(f"{Colors.RED}[!] Connection timed out: {self.host}:{self.port}")
    print("[!] Server might be unreachable or too slow to respond{Colors.RESET}")
```

Connection error handling:
1. Identifies specific types of connection failures
2. Provides user-friendly error messages
3. Offers troubleshooting guidance
4. Logs detailed error information

### Transfer Errors

```python
# Check if we're in the middle of a file download
if file_download and current_file:
    # Calculate elapsed time since last activity
    idle_time = time.time() - self.last_activity
    if idle_time > 10.0:  # If no activity for 10+ seconds
        logging.warning("File transfer timeout")
        print(f"{Colors.YELLOW}\n[!] File transfer timed out{Colors.RESET}")
        file_download = False
        current_file.close()
        current_file = None
        
        # Clean up partial file
        try:
            if os.path.exists(f"{file_name}.part"):
                os.remove(f"{file_name}.part")
        except:
            pass
            
        self.increment_stat('errors')
```

Transfer error handling:
1. Detects stalled transfers through timeouts
2. Cleans up resources (file handles, temporary files)
3. Provides clear error messages to the user
4. Updates error statistics

## User Interface

### Colorized Output

```python
# ANSI color codes for terminal output
class Colors:
    RESET = '\033[0m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
```

The client uses ANSI color codes to enhance the terminal interface:
1. Green for success messages
2. Red for errors
3. Yellow for warnings
4. Blue for directories in listings
5. Cyan for prompts and informational messages
6. Purple for section headers

### Progress Bars

```python
# Display progress bar setup
print(f"\n{Colors.CYAN}[*] Uploading {filename} ({file_size:,} bytes){Colors.RESET}")
print("[", end="", flush=True)

chunk = file.read(8192)  # 8KB chunks
while chunk:
    self.client_socket.send(chunk)
    bytes_sent += len(chunk)
    self.increment_stat('bytes_sent', len(chunk))
    
    # Update progress bar
    progress = int(50 * bytes_sent / file_size) if file_size > 0 else 50
    print("=" * (progress - (bytes_sent > 0)), end="", flush=True)
    
    chunk = file.read(8192)

print(f"] 100%")
```

Progress bars provide:
1. Visual feedback during file transfers
2. Percentage-based completion tracking
3. Real-time updates
4. Enhanced user experience for long-running operations

### Response Formatting

```python
def process_text_response(self, data):
    """Process text response from server"""
    try:
        # Try to decode as text
        response = data.decode('utf-8').strip()
        
        # Check for response code
        response_lines = response.split('\r\n')
        if response_lines and len(response_lines[0]) >= 3 and response_lines[0][0:3].isdigit():
            code = response_lines[0][0:3]
            status = response_lines[0][4:] if len(response_lines[0]) > 4 else ""
            
            # Print response with color based on code
            if code.startswith('2'):  # Success (2xx)
                print(f"\n=== {Colors.BOLD}Server Response{Colors.RESET} ===")
                print(f"Status: {Colors.GREEN}{code} {status}{Colors.RESET}")
                # Print remaining lines if any
                if len(response_lines) > 1:
                    print("Content:")
                    for line in response_lines[1:]:
                        if line.strip():
                            print(f"  {line}")
            elif code.startswith('5'):  # Error (5xx)
                print(f"\n=== {Colors.BOLD}Server Response{Colors.RESET} ===")
                print(f"Status: {Colors.RED}{code} {status}{Colors.RESET}")
                # Print remaining lines if any
                if len(response_lines) > 1:
                    print("Details:")
                    for line in response_lines[1:]:
                        if line.strip():
                            print(f"  {line}")
            else:  # Other codes
                print(f"\n=== {Colors.BOLD}Server Response{Colors.RESET} ===")
                print(f"Status: {Colors.YELLOW}{code} {status}{Colors.RESET}")
                # Print remaining lines if any
                if len(response_lines) > 1:
                    print("Content:")
                    for line in response_lines[1:]:
                        if line.strip():
                            print(f"  {line}")
        else:
            # Just print the raw response if no code is detected
            if response.strip():
                print(f"\n=== {Colors.BOLD}Server Response{Colors.RESET} ===")
                print(response)
    except UnicodeDecodeError:
        # This may be binary data that's not part of a file transfer
        # Just ignore it
        pass
```

Response formatting:
1. Parses response codes from server replies
2. Color-codes responses based on status (success, error, etc.)
3. Formats multiline responses for better readability
4. Handles binary data gracefully

## Signal Handling and Shutdown

```python
def signal_handler(self, sig, frame):
    """Handle Ctrl+C gracefully"""
    print("\n\nInterrupted by user. Disconnecting...")
    
    # Try to send QUIT command if connected
    if self.client_socket and self.running:
        try:
            self.client_socket.send("QUIT".encode('utf-8'))
            time.sleep(0.5)  # Wait briefly for server response
        except:
            pass
            
    self.disconnect()
    sys.exit(0)
```

Signal handling enables:
1. Clean shutdown on Ctrl+C (SIGINT)
2. Proper server notification before disconnecting
3. Resource cleanup

The disconnection process:

```python
def disconnect(self):
    """Disconnect from the server"""
    if not self.running:
        return  # Already disconnected
        
    self.running = False
    
    # Close socket
    if self.client_socket:
        try:
            self.client_socket.close()
        except:
            pass
        
    # Print final statistics
    print(f"\n{Colors.BOLD}Session Statistics:{Colors.RESET}")
    print(f"  Commands sent: {self.stats['commands_sent']}")
    print(f"  Files transferred: {self.stats['files_transferred']}")
    print(f"  Bytes sent: {self.stats['bytes_sent']:,}")
    print(f"  Bytes received: {self.stats['bytes_received']:,}")
    print(f"  Errors: {self.stats['errors']}")
    
    logging.info(f"Disconnected from {self.host}:{self.port}")
    logging.info(f"Session stats: {self.stats}")
    
    print(f"{Colors.GREEN}[*] Disconnected from server{Colors.RESET}")
```

The shutdown process:
1. Sets a flag to stop all threads
2. Closes the socket connection
3. Displays session statistics
4. Logs disconnection information

## Advanced Concepts

### Protocol Design

The client implements the same application protocol as the server:

1. **Command Format**: Simple text commands with space-separated arguments
2. **Response Parsing**: Handling of numeric codes with text descriptions
3. **Framing**: Special markers for binary data boundaries
4. **Status Handling**: Processing of response codes to indicate success or failure

The client's implementation of this protocol ensures compatibility with the server.

### File Transfer Protocol

The file transfer protocol uses these elements:

1. **Markers**: `FILE_START\r\n` and `FILE_END\r\n` to frame binary data
2. **Ready Signals**: `READY_FOR_FILE\r\n` to synchronize upload operations
3. **Chunking**: 8KB chunks for efficient memory usage
4. **Atomic Operations**: Using temporary files with .part extension

### Transfer Rate Calculation

```python
def format_speed(self, bytes_per_second):
    """Format transfer speed in a human-readable format"""
    if bytes_per_second >= 1024*1024:
        return f"{bytes_per_second / (1024*1024):.2f} MB/s"
    elif bytes_per_second >= 1024:
        return f"{bytes_per_second / 1024:.2f} KB/s"
    else:
        return f"{bytes_per_second:.2f} B/s"
```

This method:
1. Calculates transfer rates from bytes and time
2. Converts to appropriate units (B/s, KB/s, MB/s)
3. Formats with consistent decimal precision
4. Enhances user understanding of performance

### Socket Lifecycle Management

The client properly manages the socket lifecycle:
1. **Creation**: socket() creates the socket object
2. **Configuration**: settimeout() sets socket timeout
3. **Connection**: connect() establishes connection with server
4. **Reading/Writing**: send()/recv() for data transfer
5. **Closing**: close() releases socket resources

### Resource Cleanup

The client ensures proper resource cleanup:
1. **Socket Closing**: Socket is closed when disconnecting
2. **File Handles**: All files are closed after use
3. **Temporary Files**: Partial downloads are deleted
4. **Exception Handling**: finally blocks ensure cleanup even on error

### Concurrent Processing Model

The client uses a two-thread model:
1. **Main Thread**: Handles user input and command sending
2. **Receive Thread**: Processes server responses and file downloads

This model provides:
1. Responsive user interface during network operations
2. Background processing of potentially large responses
3. Real-time updates during file transfers
4. Clean separation of concerns