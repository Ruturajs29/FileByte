import socket
import sys
import threading
import time
import os
import logging
import signal
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ftp_client.log"),
        logging.StreamHandler()
    ]
)

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

class TCPClient:
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
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()
    
    def increment_stat(self, stat_name, value=1):
        """Increment a stat counter"""
        if stat_name in self.stats:
            self.stats[stat_name] += value
    
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
                
                except KeyboardInterrupt:
                    # Send QUIT command to server
                    try:
                        self.client_socket.send("QUIT".encode('utf-8'))
                        self.increment_stat('commands_sent')
                        time.sleep(0.5)  # Wait for server response
                    except:
                        pass
                    self.disconnect()
                    break
                except socket.timeout:
                    logging.warning("Socket operation timed out")
                    print(f"{Colors.YELLOW}[!] Operation timed out. Try again.{Colors.RESET}")
                    self.increment_stat('errors')
                    continue
                except Exception as e:
                    logging.error(f"Error processing command: {str(e)}")
                    print(f"{Colors.RED}\n[!] Error processing command: {str(e)}{Colors.RESET}")
                    self.increment_stat('errors')
                    
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
        except Exception as e:
            logging.error(f"Error connecting to server: {str(e)}")
            print(f"{Colors.RED}[!] Error connecting to server: {str(e)}{Colors.RESET}")
        finally:
            self.disconnect()
    
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
    
    def handle_local_cd(self, directory):
        """Change local working directory"""
        try:
            os.chdir(directory)
            print(f"Local directory changed to: {os.getcwd()}")
        except Exception as e:
            print(f"{Colors.RED}[!] Error changing directory: {str(e)}{Colors.RESET}")
    
    def handle_local_pwd(self):
        """Print local working directory"""
        try:
            print(f"Local working directory: {os.getcwd()}")
        except Exception as e:
            print(f"{Colors.RED}[!] Error getting working directory: {str(e)}{Colors.RESET}")
    
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
            
        except socket.timeout:
            print(f"{Colors.RED}\n[!] Socket timeout during file upload{Colors.RESET}")
            self.increment_stat('errors')
        except Exception as e:
            logging.error(f"Error uploading file: {str(e)}")
            print(f"{Colors.RED}\n[!] Error uploading file: {str(e)}{Colors.RESET}")
            self.increment_stat('errors')
    
    def print_help(self):
        """Print help message with available commands"""
        print(f"\n{Colors.BOLD}{Colors.PURPLE}=== FTP Client Help ==={Colors.RESET}")
        
        print(f"{Colors.BOLD}Server Commands:{Colors.RESET}")
        for cmd, desc in self.available_commands.items():
            print(f"  {Colors.CYAN}{cmd:<15}{Colors.RESET} - {desc}")
            
        print(f"\n{Colors.BOLD}Local Commands:{Colors.RESET}")
        print(f"  {Colors.CYAN}{'LOCAL_LS':<15}{Colors.RESET} - List files in local directory")
        print(f"  {Colors.CYAN}{'LOCAL_CD <dir>':<15}{Colors.RESET} - Change local directory")
        print(f"  {Colors.CYAN}{'LOCAL_PWD':<15}{Colors.RESET} - Show current local directory")
        print(f"  {Colors.CYAN}{'EXIT':<15}{Colors.RESET} - Close the client (same as QUIT)")
        
        print(f"{Colors.PURPLE}{Colors.BOLD}{'='*25}{Colors.RESET}")
    
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
                
                # Update stats
                self.increment_stat('bytes_received', len(data))
                self.update_activity()
                
                # Check if we're in file transfer mode for PUT command
                if b"READY_FOR_FILE" in data:
                    self.file_transfer_mode = True
                    self.file_transfer_data = data
                    continue
                
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
                    
                    # Extract any file data after the marker
                    file_data = data.split(b"FILE_START\r\n", 1)
                    if len(file_data) > 1:
                        chunk = file_data[1]
                        # Check if this chunk contains the end marker
                        if b"FILE_END\r\n" in chunk:
                            end_parts = chunk.split(b"FILE_END\r\n", 1)
                            current_file.write(end_parts[0])
                            bytes_received += len(end_parts[0])
                            file_download = False
                            current_file.close()
                            current_file = None
                            
                            # Rename from .part to final filename
                            try:
                                if os.path.exists(file_name):
                                    os.remove(file_name)
                                os.rename(temp_file_name, file_name)
                            except Exception as e:
                                logging.error(f"Error renaming file: {str(e)}")
                                print(f"{Colors.RED}[!] Error finalizing file: {str(e)}{Colors.RESET}")
                                
                            # Calculate transfer speed
                            elapsed = time.time() - download_start_time
                            speed = bytes_received / elapsed if elapsed > 0 else 0
                            
                            print("] 100%")
                            print(f"{Colors.GREEN}\n[*] File download complete: {bytes_received:,} bytes received")
                            print(f"[*] Transfer rate: {self.format_speed(speed)}{Colors.RESET}")
                            
                            self.increment_stat('files_transferred')
                            
                            # Process any text response after the file
                            if len(end_parts) > 1 and end_parts[1]:
                                self.process_text_response(end_parts[1])
                        else:
                            current_file.write(chunk)
                            bytes_received += len(chunk)
                            # Update progress bar
                            if file_size > 0:
                                progress = int(50 * bytes_received / file_size)
                                print("=" * progress, end="", flush=True)
                    continue
                
                # Continue downloading file if in progress
                if file_download and current_file:
                    # Check if this chunk contains the end marker
                    if b"FILE_END\r\n" in data:
                        end_parts = data.split(b"FILE_END\r\n", 1)
                        current_file.write(end_parts[0])
                        bytes_received += len(end_parts[0])
                        file_download = False
                        current_file.close()
                        current_file = None
                        
                        # Rename from .part to final filename
                        try:
                            if os.path.exists(file_name):
                                os.remove(file_name)
                            os.rename(f"{file_name}.part", file_name)
                        except Exception as e:
                            logging.error(f"Error renaming file: {str(e)}")
                            print(f"{Colors.RED}[!] Error finalizing file: {str(e)}{Colors.RESET}")
                        
                        # Calculate transfer speed
                        elapsed = time.time() - download_start_time
                        speed = bytes_received / elapsed if elapsed > 0 else 0
                        
                        print("] 100%")
                        print(f"{Colors.GREEN}\n[*] File download complete: {bytes_received:,} bytes received")
                        print(f"[*] Transfer rate: {self.format_speed(speed)}{Colors.RESET}")
                        
                        self.increment_stat('files_transferred')
                        
                        # Process any text response after the file
                        if len(end_parts) > 1 and end_parts[1]:
                            self.process_text_response(end_parts[1])
                    else:
                        current_file.write(data)
                        bytes_received += len(data)
                        # Update progress bar
                        if file_size > 0:
                            progress = min(50, int(50 * bytes_received / file_size))
                            print("=" * (progress - (bytes_received > 0)), end="", flush=True)
                    continue
                
                # Regular text response processing
                self.process_text_response(data)
                    
            except socket.timeout:
                # Socket timeout during receive - can happen normally
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
            except ConnectionResetError:
                logging.warning("Connection reset by server")
                print(f"{Colors.YELLOW}[!] Connection reset by server{Colors.RESET}")
                self.disconnect()
                break
            except Exception as e:
                if self.running:
                    logging.error(f"Error receiving message: {str(e)}")
                    print(f"{Colors.RED}\n[!] Error receiving message: {str(e)}{Colors.RESET}")
                    self.increment_stat('errors')
                # Close file if open
                if current_file:
                    current_file.close()
                    # Clean up partial file
                    try:
                        if file_name and os.path.exists(f"{file_name}.part"):
                            os.remove(f"{file_name}.part")
                    except:
                        pass
                break
    
    def format_speed(self, bytes_per_second):
        """Format transfer speed in a human-readable format"""
        if bytes_per_second >= 1024*1024:
            return f"{bytes_per_second / (1024*1024):.2f} MB/s"
        elif bytes_per_second >= 1024:
            return f"{bytes_per_second / 1024:.2f} KB/s"
        else:
            return f"{bytes_per_second:.2f} B/s"
    
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
