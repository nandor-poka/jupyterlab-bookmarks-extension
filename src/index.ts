import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './jupyterlab-bookmarks-extension';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ILauncher } from '@jupyterlab/launcher';
import { ICommandPalette, InputDialog } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel, INotebookModel} from '@jupyterlab/notebook';
import { notebookIcon, closeIcon, addIcon } from '@jupyterlab/ui-components';
import { Menu } from '@lumino/widgets';
import { IDisposable } from '@lumino/disposable';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';
import { FileDialog } from '@jupyterlab/filebrowser';
import { IDocumentManager } from '@jupyterlab/docmanager'
const TITLE = 'Bookmarks';
const NOTEBOOK_FACTORY = 'Notebook';
const PLUGIN_ID = 'jupyterlab-bookmarks-extension:bookmarks';

/**
 * Data structure is Array of arrays => [[name, path in current JL root, absolute_path, temp_path, disabled]]
 */
let bookmarks: Array<Array<string>> = new Array<Array<string>>();
let settingsObject: ISettingRegistry.ISettings = null;
const bookmarkCommands: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();
const bookmakrLaunchers: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();
/**
 * Initialization data for the jupyterlab-bookmarks-extension extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [
    ILauncher,
    ISettingRegistry,
    IMainMenu,
    ICommandPalette,
    INotebookTracker,
    IDocumentManager
  ],
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    settingsRegistry: ISettingRegistry,
    mainMenu: IMainMenu,
    commandPalette: ICommandPalette,
    notebookTracker: INotebookTracker,
    docManager: IDocumentManager
  ) => {
    // Extension level constants / variables
    const { commands } = app;
    const commandPrefix = 'jupyterlab-bookmarks-extension:';
    const bookmarksMainMenu = new Menu({ commands });
    bookmarksMainMenu.title.label = TITLE;

    mainMenu.addMenu(bookmarksMainMenu);
    const addBookmarkContextMenuCommand = {
      id: commandPrefix + 'addBookmark',
      options: {
        label: 'Add to bookmarks',
        caption: 'Add to bookmarks',
        execute: async (): Promise<any> => {
          const currentDoc = notebookTracker.currentWidget;
          currentDoc.context.fileChanged.connect(syncBookmark);
          const currentDocName = currentDoc.context.contentsModel.name;
          const currentDocPath = currentDoc.context.path;
          addBookmarkItem(currentDocName, currentDocPath);
        }
      }
    };

    const addBookmarkLauncherCommand = {
      id:commandPrefix+'addBookmarkFromLauncher',
      options:{
        label: 'Add bookmark',
        caption: 'Add bookmark',
        icon: addIcon,
        execute: () => {
          FileDialog.getOpenFiles({
            manager: docManager,
            filter: model => model.type == 'notebook'
          }).then(result =>{
            result.value.forEach(selectedFile => {
              addBookmarkItem(selectedFile.name, selectedFile.path);
            });
            
          })
        }
      }
    }
    const removeBookmarkCommand = {
      id: commandPrefix + 'removeBookmark',
      options: {
        label: 'Delete Bookmark',
        caption: 'Delete Bookmark',
        icon: closeIcon,
        execute: (): void => {
          InputDialog.getItem({
            title: 'Select bookmark to delete',
            items: Array.from(bookmakrLaunchers, item => {
              return item[0];
            })
          }).then( async (result) => {
            if (result.value !== null && result.value !== '') {
              const bookmarkToDelete: string = result.value;
              bookmakrLaunchers.get(bookmarkToDelete).dispose();
              bookmakrLaunchers.delete(bookmarkToDelete);
              bookmarkCommands.get(bookmarkToDelete).dispose();
              bookmarkCommands.delete(bookmarkToDelete);
              let updatedBookmarks: Array<Array<string>> = new Array<Array<string>>();
              bookmarks.forEach(bookmarkItem =>{
                if(bookmarkItem[0] !== bookmarkToDelete){
                  updatedBookmarks.push(bookmarkItem)
                }
              });
              bookmarks = updatedBookmarks;
              await settingsObject.set('bookmarks', bookmarks);
            }
          });
        }
      }
    };

    // Code for startup
    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settingsRegistry.load(PLUGIN_ID)])
      .then(([, settings]) => {
        // Read the settings
        settingsObject = settings;
        loadSetting(settingsObject);

        // Listen for your plugin setting changes using Signal
        //settingsObject.changed.connect(loadSetting);

        requestAPI<any>('updateBookmarks', {
          method: 'POST',
          body: JSON.stringify({ bookmarksData: bookmarks })
        })
          .then(data => {
            bookmarks = data.bookmarks;
            bookmarks.forEach(bookmarkItem => {
              addBookmark(bookmarkItem);
            });
            settingsObject.set('bookmarks', bookmarks);
          })
          .catch(reason => {
            window.alert(
              `Failed to load bookmarks from server side during startup.\n${reason}`
            );

            console.error(
              `Failed to load bookmarks from server side during startup.\n${reason}`
            );
          });
        notebookTracker.currentChanged.connect(addAutoSyncToBookmark);
      })
      .catch(reason => {
        window.alert(
          `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
        );
        console.error(
          `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
        );
      });

    // Add command to context menu, when clicked on an open notebook.
    commands.addCommand(addBookmarkContextMenuCommand.id, addBookmarkContextMenuCommand.options);
    commands.addCommand(removeBookmarkCommand.id,removeBookmarkCommand.options);
    commands.addCommand(addBookmarkLauncherCommand.id, addBookmarkLauncherCommand.options);
    app.contextMenu.addItem({
      command: addBookmarkContextMenuCommand.id,
      selector: '.jp-Notebook',
      rank: 10
    });

    launcher.add({
      command: removeBookmarkCommand.id,
      category: TITLE,
      rank: 2
    });
    launcher.add({
      command: addBookmarkLauncherCommand.id,
      category: TITLE,
      rank: 1
    });
    console.log(
      'JupyterLab extension jupyterlab-bookmarks-extension is activated!'
    );

    // Utilities
    /**
     * Load the settings for this extension
     *
     * @param settings Extension settings
     */
    function loadSetting(settings: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      bookmarks = settings.get('bookmarks').composite as Array<Array<string>>;
    }

    function addBookmark(bookmarkItem: string[]): void {
      const commandId: string = bookmarkItem[0];
      const disabled = bookmarkItem[4] === 'True';
      if (commands.hasCommand(commandPrefix + commandId)) {
        const commandToDelete = bookmarkCommands.get(commandId);
        if (commandToDelete !== undefined) {
          commandToDelete.dispose();
          bookmarkCommands.delete(commandId);
        }
      }
      const commandPath: string =
        bookmarkItem[1] === bookmarkItem[3] ? bookmarkItem[1] : bookmarkItem[3];
      const commandDisposable = commands.addCommand(commandPrefix + commandId, {
        label: commandId,
        caption: commandId,
        icon: notebookIcon,
        execute: async () => {
          if (disabled) {
            return window.alert(
              `This bookmark is currently unavailable.\nMake sure that ${
                bookmarkItem[2]
              } is accessible.`
            );
          }
          return commands.execute('docmanager:open', {
            path: commandPath,
            factory: NOTEBOOK_FACTORY
          });
        }
      });
      bookmarkCommands.set(commandId, commandDisposable);
      const launcherItem: IDisposable = launcher.add({
        command: commandPrefix + commandId,
        category: disabled ? 'Disabled bookmarks' : TITLE
      });
      bookmakrLaunchers.set(commandId, launcherItem);
      console.log(commandPrefix + commandId + ' added to Launcher');
    }

    async function addBookmarkItem(currentDocName:string, currentDocPath:string):Promise<void>{
      const bookmarkItemJSON = await requestAPI<any>('getAbsPath', {
        method: 'POST',
        body: JSON.stringify([
          currentDocName,
          currentDocPath,
          '',
          '',
          'False'
        ])
      });
      if (!bookmarkItemJSON.error) {
        const bookmarkItem = bookmarkItemJSON.bookmarkItem;
        bookmarks.push(bookmarkItem);
        addBookmark(bookmarkItem);
      } else {
        window.alert(
          `Failed to save bookmark.\n${bookmarkItemJSON.reason}`
        );
      }
      await settingsObject.set('bookmarks', bookmarks);
    }

    function syncBookmark(
      bookmarkedNotebookModel: DocumentRegistry.IContext<INotebookModel>,
      contentsModel: Contents.IModel
    ): void {
      for (let i = 0; i < bookmarks.length; i++) {
        if (
          bookmarks[i][3].startsWith('.tmp') &&
          bookmarks[i][3] === bookmarkedNotebookModel.path
        ) {
          requestAPI<any>('syncBookmark', {
            method: 'POST',
            body: JSON.stringify(bookmarks[i])
          })
            .then(result => {
              if (!result.success) {
                window.alert(
                  `Failed to set up autosync for ${bookmarks[i]}.\n${
                    result.reason
                  }`
                );
              }
            })
            .catch(error => {
              window.alert(
                `Failed to set up autosync for ${bookmarks[i][0]}.\n${error}`
              );
            });
          break;
        }
      }
    }

    function addAutoSyncToBookmark(
      notebookTracker: INotebookTracker,
      notebookPanel: NotebookPanel
    ): void {
      for (let i = 0; i < bookmarks.length; i++) {
        if (
          bookmarks[i][3].startsWith('.tmp') &&
          bookmarks[i][3] === notebookPanel.context.path
        ) {
          notebookPanel.context.fileChanged.connect(syncBookmark);
          break;
        }
      }
    }
  }
};

export default extension;
