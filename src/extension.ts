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
				file: path.normalize(data[1]),
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

		return { error: { name: "Tag not found in file", message: "Tag not found in file" } };
	} catch (err) {
		return { error: { name: "Exeption happend", message: `${err}` } };
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

		const workspaces = vscode.workspace.workspaceFolders;
		if (!workspaces) {
			vscode.window.showErrorMessage('Workspace folder not found.');
			return;
		}

		vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Searching for definition...' },
			async () => {
				let foundTag: Tag | undefined = undefined;
				let foundFolder: string | undefined = undefined;
				const errors: Error[] = [];

				for (const workspace of workspaces) {
					const folder = path.normalize(workspace.uri.fsPath);
					const ret = findCtag(path.join(folder, ".tags"), selectedText);

					if (ret.error) {
						console.error(ret.error);
						errors.push(ret.error);
					} else {
						foundTag = ret.tag!;
						foundFolder = folder;
						console.log(`Tag found in ${foundTag.file}:${foundTag.line}`);
						break;
					}
				}

				if (foundTag === undefined || foundFolder === undefined) {
					vscode.window.showErrorMessage(`Couldn't parse '.tags' from any workspace folder(s). Cause: ${errors.map(e => e.message).join(', ')}`);
					return;
				}

				const filePath = path.isAbsolute(foundTag.file) ? foundTag.file : path.join(foundFolder, foundTag.file);
				console.log(`File path: ${filePath}`);
				vscode.workspace.openTextDocument(filePath).then((doc) => {
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
