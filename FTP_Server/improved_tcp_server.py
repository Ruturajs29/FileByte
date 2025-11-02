import socket
import threading
import sys
import os
import signal
import shutil
import time
import logging
from datetime import datetime
from collections import defaultdict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ftp_server.log"),
        logging.StreamHandler()
    ]
)

# Standard FTP response codes
FTP_CODES = {
    'READY': '220 Service ready',
    'GOODBYE': '221 Service closing control connection',
    'FILE_STATUS_OK': '226 Closing data connection, file transfer successful',
    'CMD_OK': '200 Command OK',
    'ENTERING_TRANSFER': '150 File status okay; about to open data connection',
    'SYNTAX_ERROR': '500 Syntax error, command unrecognized',
    'SYNTAX_ERROR_PARAM': '501 Syntax error in parameters or arguments',
    'NOT_IMPLEMENTED': '502 Command not implemented',
    'BAD_SEQUENCE': '503 Bad sequence of commands',
    'NOT_IMPLEMENTED_PARAM': '504 Command not implemented for that parameter',
    'NOT_LOGGED_IN': '530 Not logged in',
    'FILE_UNAVAILABLE': '550 File unavailable (e.g., file not found, no access)',
    'PAGE_TYPE_UNKNOWN': '551 Requested action aborted, page type unknown',
    'EXCEEDED_STORAGE': '552 Requested file action aborted, exceeded storage allocation',
    'FILENAME_NOT_ALLOWED': '553 Requested action not taken, file name not allowed',
    'ACTION_NOT_TAKEN': '450 Requested action not taken',
    'LOCAL_ERROR': '451 Requested action aborted, local error',
    'INSUFFICIENT_STORAGE': '452 Requested action not taken, insufficient storage'
}

class ClientHandler:
    """Class to store information about connected clients"""
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
        
    def log_command(self, command):
        """Log a command executed by this client"""
        timestamp = datetime.now()
        self.last_activity = timestamp
        self.commands_executed.append((timestamp, command))
        
    def update_activity(self):
        """Update the last activity timestamp"""
        self.last_activity = datetime.now()
        
    def get_address_string(self):
        """Return a string representation of the client address"""
        return f"{self.ip}:{self.port}"
    
    def get_connection_duration(self):
        """Get the duration of the connection"""
        return datetime.now() - self.connected_time
    
    def get_idle_time(self):
        """Get the time since last activity"""
        return datetime.now() - self.last_activity
    
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


class TCPServer:
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
        
    def signal_handler(self, sig, frame):
        """Handle termination signals"""
        logging.info(f"Received signal {sig}, shutting down...")
        self.stop()
        
    def increment_stat(self, stat_name, value=1):
        """Thread-safe increment of a stat counter"""
        with self.stats_lock:
            if stat_name in self.stats:
                self.stats[stat_name] += value
                
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
    
    def handle_delete(self, client, filename):
        """Handle DEL command - delete a file"""
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
                client.send_response('FILE_UNAVAILABLE', f"Cannot delete directory: {filename}")
                return
            
            try:
                # Delete file
                os.remove(file_path)
                client.send_response('CMD_OK', f"File {filename} deleted successfully")
                logging.info(f"File {filename} deleted by {client.get_address_string()}")
            except PermissionError:
                client.send_response('FILE_UNAVAILABLE', f"Permission denied: {filename}")
                logging.warning(f"Permission denied deleting {filename} by {client.get_address_string()}")
                self.increment_stat('errors')
            except Exception as e:
                client.send_response('LOCAL_ERROR', f"Error deleting file: {str(e)}")
                logging.error(f"Error deleting file {filename}: {e}")
                self.increment_stat('errors')
                
        except Exception as e:
            logging.error(f"Error handling DELETE command: {e}")
            client.send_response('LOCAL_ERROR', f"Error: {str(e)}")
            self.increment_stat('errors')
    
    def handle_stat(self, client):
        """Handle STAT command - return server status and statistics"""
        try:
            # Update activity time
            client.update_activity()
            
            # Calculate uptime
            uptime = datetime.now() - self.start_time
            days, remainder = divmod(uptime.total_seconds(), 86400)
            hours, remainder = divmod(remainder, 3600)
            minutes, seconds = divmod(remainder, 60)
            uptime_str = f"{int(days)}d {int(hours)}h {int(minutes)}m {int(seconds)}s"
            
            # Build stats message
            with self.stats_lock:
                stats_copy = dict(self.stats)
                
            stats_msg = f"Server Statistics:\r\n"
            stats_msg += f"  Uptime: {uptime_str}\r\n"
            stats_msg += f"  Connections: {stats_copy['connections']}\r\n"
            stats_msg += f"  Commands processed: {stats_copy['commands_processed']}\r\n"
            stats_msg += f"  Files transferred: {stats_copy['files_transferred']}\r\n"
            stats_msg += f"  Bytes sent: {stats_copy['bytes_sent']:,}\r\n"
            stats_msg += f"  Bytes received: {stats_copy['bytes_received']:,}\r\n"
            stats_msg += f"  Errors: {stats_copy['errors']}\r\n"
            
            # Add current client count
            with self.client_lock:
                client_count = len(self.clients)
            stats_msg += f"  Active clients: {client_count}\r\n"
            
            # Add client-specific stats
            stats_msg += f"\r\nYour Connection:\r\n"
            stats_msg += f"  Connected from: {client.get_address_string()}\r\n"
            stats_msg += f"  Connected since: {client.connected_time.strftime('%Y-%m-%d %H:%M:%S')}\r\n"
            stats_msg += f"  Idle time: {client.get_idle_time().seconds} seconds\r\n"
            stats_msg += f"  Commands executed: {len(client.commands_executed)}\r\n"
            stats_msg += f"  Bytes sent: {client.bytes_sent:,}\r\n"
            stats_msg += f"  Bytes received: {client.bytes_received:,}\r\n"
            
            client.send_response('CMD_OK', stats_msg)
            
        except Exception as e:
            logging.error(f"Error handling STAT command: {e}")
            client.send_response('LOCAL_ERROR', f"Error: {str(e)}")
            self.increment_stat('errors')
    
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
