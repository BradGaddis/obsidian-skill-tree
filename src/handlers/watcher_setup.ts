import { App, TFile } from "obsidian";
import { view } from "../utils/globals";
import { handleFileModify, handleFileDelete, handleFileChange } from "./file_handlers";

let fileWatcherRef: any = null;
let deleteWatcherRef: any = null;
let modifiedWatcherRef: any = null;
let dataFileWatcherRef: any = null;

export function SetupFileWatchers(app: App = view.app): void {
    CleanupFileWatchers();

    const listener = async (file: TFile) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;
        await handleFileChange(app, file);
    };

    const deleteListener = (file: any) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;
        handleFileDelete(file);
    };

    const modified = async (file: any) => {
        if (!(file instanceof TFile) || !file.path.endsWith('.md')) return;
        await handleFileModify(app, file);
    };

    modifiedWatcherRef = app.vault.on('modify', modified);
    fileWatcherRef = app.metadataCache.on('changed', listener);
    deleteWatcherRef = app.vault.on('delete', deleteListener);
}

export function CleanupFileWatchers(): void {
    if (fileWatcherRef) {
        view.app.metadataCache.offref(fileWatcherRef);
        fileWatcherRef = null;
    }
    if (deleteWatcherRef) {
        view.app.vault.offref(deleteWatcherRef);
        deleteWatcherRef = null;
    }
    if (modifiedWatcherRef) {
        view.app.vault.offref(modifiedWatcherRef);
        modifiedWatcherRef = null;
    }
    if (dataFileWatcherRef) {
        view.app.vault.offref(dataFileWatcherRef);
        dataFileWatcherRef = null;
    }
}
