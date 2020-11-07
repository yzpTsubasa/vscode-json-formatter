'use strict';

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    let config: vscode.WorkspaceConfiguration;

    // 👎 formatter implemented as separate command
    vscode.commands.registerCommand('tsubasa-json-formatter.format-json', () => {
        const { activeTextEditor } = vscode.window;
        switch (activeTextEditor && activeTextEditor.document.languageId) {
            case 'plaintext':
            case 'json':
            case 'jsonc': {
                const { document } = activeTextEditor;
                const firstLine = document.lineAt(0);
                const lastLine = document.lineAt(document.lineCount - 1);
                const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, fullRange, formatJSONDocument(document, fullRange));
                return vscode.workspace.applyEdit(edit);
            }
        }
    });

    // 👍 formatter implemented using API
    vscode.languages.registerDocumentFormattingEditProvider(['json', 'jsonc', 'plaintext'], {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            return [vscode.TextEdit.replace(fullRange, formatJSONDocument(document, fullRange))];
        }
    });

    function formatJSONDocument(document: vscode.TextDocument, fullRange: vscode.Range): string {
        let workspaceFoler = vscode.workspace.getWorkspaceFolder(document.uri);
        let workspacePath = workspaceFoler && workspaceFoler.uri.fsPath;
        if (!workspacePath) {
            workspacePath = vscode.workspace.rootPath;
        }
        if (!workspacePath) {
            throw new Error("workspacePathが不明です。");
        }
        let rawText: string = document.getText(fullRange);
        config = vscode.workspace.getConfiguration("", vscode.Uri.parse(workspacePath));
        let data = JSON.parse(rawText);
        let space = config.get("editor.tabSize");
        let sortKeys = config.get("tsubasa-json-formatter.sortKeys");
        let keepElementsOfArrayInLine = config.get("tsubasa-json-formatter.keepElementsOfArrayInLine");
        let keepKeysOfObjectInLine = config.get("tsubasa-json-formatter.keepKeysOfObjectInLine");
        return stringify(data, space, keepElementsOfArrayInLine, keepKeysOfObjectInLine, sortKeys);
    }

    /**
     * JSON字符串化
     * @param {Array|Object} value 对象
     * @param {number} space 空格数，可选。默认值：2
     * @param {string[]?} sortKeys 键排序数据，可选。默认值：null
     */
    function stringify(value, space = null, keepElementsOfArrayInLine, keepKeysOfObjectInLine, sortKeys = null, depth = 0) {
        let result = "";
        space = space === undefined ? 2 : space;
        depth = depth === undefined ? 0 : depth;
        
        /** key: value 是否换行 */
        let wrapKV = false;
        /** 对象属性 是否换行 */
        let wrapAtt = false;
        /** 数组元素 是否换行 */
        let wrapArr = false;
        wrapKV = wrapAtt = wrapArr = space > 0;


        /** 是否可以显示在同一行 */
        let canSameLine = false;
        if (value instanceof Array) {
            switch (keepElementsOfArrayInLine) {
                case "on": {
                    canSameLine = true;
                    break;
                }
                case "off": {
                    canSameLine = false;
                    break;
                }
                case "bottom_layer": {
                    canSameLine = value.every(v => typeof v !== "object");
                    break;
                }
            }
            if (canSameLine) {
                wrapKV = false;
                wrapArr = false;
            }
        } else if (typeof value === "object") {
            switch (keepKeysOfObjectInLine) {
                case "on": {
                    canSameLine = true;
                    break;
                }
                case "off": {
                    canSameLine = false;
                    break;
                }
                case "bottom_layer": {
                    canSameLine = true;
                    for (let k in value) {
                        if (value.hasOwnProperty(k)) {
                            if (typeof value[k] === "object") {
                                canSameLine = false;
                                break;
                            }
                        }
                    }
                    break;
                }
            }
            if (canSameLine) {
                wrapAtt = false;
                wrapKV = false;
            }
        }
        let space1 = "";
        let n = (depth + 1) * space;;
        while (--n >= 0) {
            space1 += " ";
        }
        let space2 = space1.substr(space);

        if (value instanceof Array) {
            result += "[";
            if (wrapKV) {
                result += "\n";
            }
            ++depth;
            if (!wrapArr && wrapKV) {
                result += space1;
            }
            result += value.map(v => {
                return `${wrapArr ? space1 : ""}${stringify(v, space, keepElementsOfArrayInLine, keepKeysOfObjectInLine, sortKeys, depth)}`;
            }).join(!wrapArr ? ", " : ",\n");
        } else if (typeof value === "object") {
            result += "{";
            if (wrapKV) {
                result += "\n";
            }
            ++depth;
            let keys = Object.keys(value);
            keys = keys.filter(v => value.hasOwnProperty(v));
            if (sortKeys instanceof Array) {
                let num = sortKeys.length * 2;
                keys.sort((keyA, keyB) => {
                    let idxA = sortKeys.indexOf(keyA);
                    let idxB = sortKeys.indexOf(keyB);
                    idxA = (idxA + num) % num;
                    idxB = (idxB + num) % num;
                    return idxA - idxB;
                });
            }
            if (!wrapAtt && wrapKV) {
                result += space1;
            }
            result += keys.map(v => {
                return `${wrapAtt ? space1 : ""}"${v}": ${stringify(value[v], space, keepElementsOfArrayInLine, keepKeysOfObjectInLine, sortKeys, depth)}`;
            }).join(!wrapAtt ? ", " : ",\n");
        } else if (typeof value === "number" || typeof value === "boolean") {
            result += value;
        } else if (typeof value === "string") {
            result += `"${value}"`;
        }
        if (value instanceof Array) {
            if (wrapKV) {
                result += "\n";
                result += space2;
            }
            result += "]";
        } else if (typeof value === "object") {
            if (wrapKV) {
                result += "\n";
                result += space2;
            }
            result += "}";
        }
        return result;
    }
}


