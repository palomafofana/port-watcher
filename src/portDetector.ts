import * as cp from 'child_process';
import { promisify } from 'util';

const exec = promisify(cp.exec);

export interface PortInfo {
  port: number;
  pid: number;
  process: string;
  protocol: string;
}

type KillMode = 'graceful' | 'force';

export async function getActivePorts(): Promise<PortInfo[]> {
  try {
    const platform = process.platform;
    
    if (platform === 'darwin' || platform === 'linux') {
      return await getPortsMacLinux();
    } else if (platform === 'win32') {
      return await getPortsWindows();
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (error) {
    console.error('Error getting active ports:', error);
    return [];
  }
}

async function getPortsMacLinux(): Promise<PortInfo[]> {
  const { stdout } = await exec('lsof -i -P -n | grep LISTEN');
  return parseUnixOutput(stdout);
}

async function getPortsWindows(): Promise<PortInfo[]> {
  const { stdout } = await exec('netstat -ano | findstr LISTENING');
  return parseWindowsOutput(stdout);
}

function parseUnixOutput(output: string): PortInfo[] {
  const lines = output.trim().split('\n');
  const ports: PortInfo[] = [];
  
  for (const line of lines) {
    const parts = line.split(/\s+/);
    
    if (parts.length >= 9) {
      const process = parts[0];
      const pid = parseInt(parts[1], 10);
      const addressPort = parts[8];
      
      // Extract port from address
      const portMatch = addressPort.match(/:(\d+)$/);
      
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        const protocol = parts[7]; // TCP or UDP
        
        ports.push({ port, pid, process, protocol });
      }
    }
  }
  
  return ports;
}

function parseWindowsOutput(output: string): PortInfo[] {
  const lines = output.trim().split('\n');
  const ports: PortInfo[] = [];
  
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    
    if (parts.length >= 5) {
      const protocol = parts[0];
      const addressPort = parts[1];
      const pid = parseInt(parts[4], 10);
      
      const portMatch = addressPort.match(/:(\d+)$/);
      
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        
        ports.push({ 
          port, 
          pid, 
          process: 'Unknown', // Windows netstat doesn't show process name
          protocol 
        });
      }
    }
  }
  
  return ports;
}

export async function killProcess(pid: number, mode: KillMode = 'force'): Promise<boolean> {
  try {
    const platform = process.platform;
    const command = platform === 'win32'
      ? mode === 'force'
        ? `taskkill /F /PID ${pid}`
        : `taskkill /PID ${pid}`
      : mode === 'force'
        ? `kill -9 ${pid}`
        : `kill -15 ${pid}`;

    await exec(command);
    return true;
  } catch (error) {
    console.error(`Error killing process ${pid}:`, error);
    return false;
  }
}