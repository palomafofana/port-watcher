import * as vscode from 'vscode';
import { getActivePorts, killProcess } from './portDetector'; 

export function activate(context: vscode.ExtensionContext) {
  console.log('Port Watcher activated');

  const disposable = vscode.commands.registerCommand(
    'port-watcher.showPorts', 
    async () => {
      try {
        const ports = await getActivePorts();
        if (!ports || ports.length === 0) {
          vscode.window.showInformationMessage('No active ports found.');
          return;
        }

        const items = ports.map(p => ({
          label: `Port ${p.port}`,
          description: `${p.process} (PID: ${p.pid})`,
          portInfo: p
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a port to kill its process'
        });

        if (!selected) {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Kill process ${selected.portInfo.process} (PID: ${selected.portInfo.pid}) on port ${selected.portInfo.port}?`,
          { modal: true },
          'Yes'
        );

        if (confirm === 'Yes') {
          const ok = await killProcess(selected.portInfo.pid);
          if (ok) {
            vscode.window.showInformationMessage(`Killed process on port ${selected.portInfo.port}`);
          } else {
            vscode.window.showErrorMessage(`Failed to kill process ${selected.portInfo.pid}`);
          }
        }
      } catch (err) {
        console.error('Error in port-watcher.showPorts:', err);
        vscode.window.showErrorMessage('Failed to list/kill ports. See Extension Host log for details.');
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  console.log('Port Watcher deactivated');
}