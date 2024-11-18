import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

type Tag = {
	tag: string,
	file: string,
	regex: string,
	line: number,
	char: number
}

function findCtag(filePath: string, selectedText: string): Tag | null {
	const reg = new RegExp(`^${selectedText}(\\(?|\\s*)$`);

	try {
		let content = fs.readFileSync(filePath, 'utf8');

		for (const line of content.split('\n')) {
			if (line.startsWith("!_TAG")) {
				continue;
			}

			const data = line.split('\t');
			if (!reg.test(data[0])) {
				continue;
			}

			const tag: Tag = {
				tag: data[0],
				file: data[1],
				regex: data[2],
				line: -1,
				char: -1
			};

			for (let i = 3; i < data.length; i++) {
				if (data[i].startsWith('line:')) {
					tag.line = parseInt(data[i].split(':')[1]);
					tag.char = tag.regex.substring(2).indexOf(tag.tag);
					break;
				}
			}

			if (tag.line === -1) {
				vscode.window.showWarningMessage(`No line number is found for '${tag.tag}' tag.`);
			}

			return tag;
		}
	} catch (err) {
		console.error(err);
	}

	return null;
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('quick-ctags-parser.jumpToDefinition', () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showInformationMessage('No editor is active.');
			return;
		}

		const document = editor.document;
		const selection = editor.selection;
		const selectedText = document.getText(selection);

		if (!selectedText) {
			vscode.window.showInformationMessage('No function selected.');
			return;
		}

		const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!folder) {
			vscode.window.showErrorMessage('No workspace folder found.');
			return;
		}

		const tag = findCtag(path.join(folder, ".tags"), selectedText);
		if (tag === null) {
			vscode.window.showErrorMessage(`${path.join(folder, ".tags")} cannot be parsed.`);
			return;
		}

		vscode.workspace.openTextDocument(path.join(folder, tag.file)).then((doc) => {
			vscode.window.showTextDocument(doc).then((editor) => {
				const start = new vscode.Position(
					Math.max(0, tag.line - 1),
					Math.max(0, tag.char)
				);
				const end = new vscode.Position(
					Math.max(0, tag.line - 1),
					Math.max(0, tag.char) + tag.tag.length
				);
				editor.selection = new vscode.Selection(start, end);
				editor.revealRange(new vscode.Range(start, end));
			});
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
