const net = require('net');
const fs = require('fs');
const path = require('path');
const tcpConfig = require('../config/tcpConfig');

class TCPClient {
  constructor() {
    this.host = tcpConfig.host;
    this.port = tcpConfig.port;
    this.timeout = tcpConfig.timeout;
  }

  /**
   * Create a connection to the TCP server
   * @returns {Promise<net.Socket>}
   */
  createConnection() {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeout);

      socket.connect(this.port, this.host, () => {
        console.log(`✓ Connected to TCP server at ${this.host}:${this.port}`);
        resolve(socket);
      });

      socket.on('error', (err) => {
        console.error('TCP connection error:', err.message);
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('TCP connection timeout'));
      });
    });
  }

  /**
   * Wait for a specific marker in the data stream
   * @param {net.Socket} socket 
   * @param {string} marker 
   * @param {number} timeout 
   * @returns {Promise<Buffer>}
   */
  waitForMarker(socket, marker, timeout = 10000) {
    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      const timer = setTimeout(() => {
        socket.removeAllListeners('data');
        reject(new Error(`Timeout waiting for marker: ${marker}`));
      }, timeout);

      const dataHandler = (data) => {
        buffer = Buffer.concat([buffer, data]);
        const markerIndex = buffer.indexOf(marker);
        
        if (markerIndex !== -1) {
          clearTimeout(timer);
          socket.removeListener('data', dataHandler);
          resolve(buffer);
        }
      };

      socket.on('data', dataHandler);
    });
  }

  /**
   * Upload a file to the TCP server using PUT command
   * @param {string} localPath - Local file path
   * @param {string} remoteFilename - Remote filename on server
   * @returns {Promise<Object>}
   */
  async put(localPath, remoteFilename) {
    let socket = null;
    
    try {
      // Check if file exists
      if (!fs.existsSync(localPath)) {
        throw new Error(`File not found: ${localPath}`);
      }

      const fileStats = fs.statSync(localPath);
      const fileSize = fileStats.size;

      socket = await this.createConnection();

      // Wait for welcome message
      await this.waitForMarker(socket, '\r\n', 5000);

      // Send PUT command
      const putCommand = `PUT ${remoteFilename}\r\n`;
      socket.write(putCommand);
      console.log(`→ Sent: PUT ${remoteFilename}`);

      // Wait for READY_FOR_FILE or error response
      const response = await this.waitForMarker(socket, '\r\n', 10000);
      const responseStr = response.toString('utf-8');
      
      // Check if server is ready
      if (!responseStr.includes('150') && !responseStr.includes('READY')) {
        throw new Error(`Server not ready for file: ${responseStr}`);
      }

      // Send FILE_START marker
      socket.write('FILE_START\r\n');
      
      // Stream the file
      const fileStream = fs.createReadStream(localPath, { highWaterMark: 8192 });
      let bytesSent = 0;

      return new Promise((resolve, reject) => {
        fileStream.on('data', (chunk) => {
          socket.write(chunk);
          bytesSent += chunk.length;
        });

        fileStream.on('end', async () => {
          // Send FILE_END marker
          socket.write('FILE_END\r\n');
          console.log(`✓ Upload complete: ${bytesSent} bytes sent`);

          try {
            // Wait for success confirmation
            const finalResponse = await this.waitForMarker(socket, '\r\n', 5000);
            const finalStr = finalResponse.toString('utf-8');
            
            socket.end();
            
            if (finalStr.includes('226') || finalStr.includes('200')) {
              resolve({
                success: true,
                message: 'File uploaded successfully',
                bytes: bytesSent,
                filename: remoteFilename
              });
            } else {
              reject(new Error(`Upload failed: ${finalStr}`));
            }
          } catch (err) {
            socket.end();
            reject(err);
          }
        });

        fileStream.on('error', (err) => {
          socket.end();
          reject(new Error(`File read error: ${err.message}`));
        });
      });

    } catch (error) {
      if (socket) socket.destroy();
      throw error;
    }
  }

  /**
   * Download a file from the TCP server using GET command
   * @param {string} remoteFilename - Remote filename on server
   * @param {Object} resStream - Response stream to pipe to (Express response object)
   * @returns {Promise<Object>}
   */
  async get(remoteFilename, resStream) {
    let socket = null;
    
    try {
      socket = await this.createConnection();

      // Wait for welcome message
      await this.waitForMarker(socket, '\r\n', 5000);

      // Send GET command
      const getCommand = `GET ${remoteFilename}\r\n`;
      socket.write(getCommand);
      console.log(`→ Sent: GET ${remoteFilename}`);

      let inFileTransfer = false;
      let bytesReceived = 0;
      let buffer = Buffer.alloc(0);

      return new Promise((resolve, reject) => {
        socket.on('data', (data) => {
          buffer = Buffer.concat([buffer, data]);

          // Check for error response
          const bufferStr = buffer.toString('utf-8');
          if (!inFileTransfer && (bufferStr.includes('550') || bufferStr.includes('File unavailable'))) {
            socket.destroy();
            reject(new Error('File not found on server'));
            return;
          }

          // Check for FILE_START marker
          const fileStartIndex = buffer.indexOf('FILE_START\r\n');
          if (fileStartIndex !== -1 && !inFileTransfer) {
            inFileTransfer = true;
            buffer = buffer.slice(fileStartIndex + 12); // Remove everything before and including FILE_START
            console.log('← Receiving file data...');
          }

          // If we're in file transfer mode, look for FILE_END
          if (inFileTransfer) {
            const fileEndIndex = buffer.indexOf('FILE_END\r\n');
            
            if (fileEndIndex !== -1) {
              // Write everything before FILE_END
              const fileData = buffer.slice(0, fileEndIndex);
              resStream.write(fileData);
              bytesReceived += fileData.length;
              
              socket.destroy();
              resStream.end();
              
              console.log(`✓ Download complete: ${bytesReceived} bytes received`);
              resolve({
                success: true,
                message: 'File downloaded successfully',
                bytes: bytesReceived,
                filename: remoteFilename
              });
            } else {
              // Write current buffer and reset
              resStream.write(buffer);
              bytesReceived += buffer.length;
              buffer = Buffer.alloc(0);
            }
          }
        });

        socket.on('error', (err) => {
          reject(new Error(`Download error: ${err.message}`));
        });

        socket.on('close', () => {
          if (!inFileTransfer) {
            reject(new Error('Connection closed before file transfer started'));
          }
        });
      });

    } catch (error) {
      if (socket) socket.destroy();
      throw error;
    }
  }

  /**
   * Delete a file from the TCP server using DEL command
   * @param {string} remoteFilename - Remote filename on server
   * @returns {Promise<Object>}
   */
  async del(remoteFilename) {
    let socket = null;
    
    try {
      socket = await this.createConnection();

      // Wait for welcome message
      await this.waitForMarker(socket, '\r\n', 5000);

      // Send DEL command
      const delCommand = `DEL ${remoteFilename}\r\n`;
      socket.write(delCommand);
      console.log(`→ Sent: DEL ${remoteFilename}`);

      // Wait for response
      const response = await this.waitForMarker(socket, '\r\n', 5000);
      const responseStr = response.toString('utf-8');
      
      socket.end();

      // Check response code
      if (responseStr.includes('200') || responseStr.includes('250')) {
        return {
          success: true,
          message: 'File deleted successfully',
          filename: remoteFilename
        };
      } else if (responseStr.includes('550')) {
        throw new Error('File not found on server');
      } else {
        throw new Error(`Delete failed: ${responseStr}`);
      }

    } catch (error) {
      if (socket) socket.destroy();
      throw error;
    }
  }

  /**
   * List files on the TCP server using LIST command
   * @returns {Promise<Object>}
   */
  async list() {
    let socket = null;
    
    try {
      socket = await this.createConnection();

      // Wait for welcome message
      await this.waitForMarker(socket, '\r\n', 5000);

      // Send LIST command
      socket.write('LIST\r\n');
      console.log('→ Sent: LIST');

      // Wait for response
      const response = await this.waitForMarker(socket, '\r\n\r\n', 5000);
      const responseStr = response.toString('utf-8');
      
      socket.end();

      return {
        success: true,
        message: 'File list retrieved successfully',
        data: responseStr
      };

    } catch (error) {
      if (socket) socket.destroy();
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new TCPClient();
