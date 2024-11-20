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

enum ErrorType {
	EXEPTION,
	EMPTY_FILE
}

type Error = {
	type: ErrorType,
	couse?: any
}

function findCtag(filePath: string, selectedText: string): { tag?: Tag, error?: Error } {
	const reg = new RegExp(`^${selectedText}(\\(?|\\s*)$`);

	try {
		const content = fs.readFileSync(filePath, 'utf8');

		for (const line of content.split('\n')) {
			if (line.startsWith("!_TAG")) {
				continue;
			}

			const data = line.split('\t');
			if (data.length < 3) {
				continue;
			}

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

			return { tag: tag };
		}

		return { error: { type: ErrorType.EMPTY_FILE } };
	} catch (err) {
		return { error: { type: ErrorType.EXEPTION, couse: err } };
	}
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
			vscode.window.showInformationMessage('No text selected.');
			return;
		}

		const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!folder) {
			vscode.window.showErrorMessage('Workspace folder not found.');
			return;
		}

		vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Searching for definition...' },
			async () => {
				const ret = findCtag(path.join(folder, ".tags"), selectedText);
				if (ret.error) {
					console.error(ret.error);
					vscode.window.showErrorMessage(`${path.join(folder, ".tags")} cannot be parsed. Couse: ${ret.error.couse}`);
					return;
				}

				const foundTag = ret.tag!;
				vscode.workspace.openTextDocument(path.join(folder, foundTag.file)).then((doc) => {
					vscode.window.showTextDocument(doc).then((editor) => {
						const start = new vscode.Position(
							Math.max(0, foundTag.line - 1),
							Math.max(0, foundTag.char)
						);
						const end = new vscode.Position(
							Math.max(0, foundTag.line - 1),
							Math.max(0, foundTag.char) + (foundTag.char !== -1 ? foundTag.tag.length : 0)
						);
						editor.selection = new vscode.Selection(start, end);
						editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
					});
				});
			});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
