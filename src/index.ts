import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './jupyterlab-bookmarks-extension';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ILauncher } from '@jupyterlab/launcher';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { notebookIcon } from '@jupyterlab/ui-components';
import { Menu } from '@lumino/widgets';
import { IDisposable } from '@lumino/disposable';

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
    INotebookTracker
  ],
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    settingsRegistry: ISettingRegistry,
    mainMenu: IMainMenu,
    commandPalette: ICommandPalette,
    notebookTracker: INotebookTracker
  ) => {
    // Extension level constants / variables
    const { commands } = app;
    const commandPrefix = 'jupyterlab-bookmarks-extension:';
    const bookmarksMainMenu = new Menu({ commands });
    bookmarksMainMenu.title.label = TITLE;
    mainMenu.addMenu(bookmarksMainMenu);
    const addFavoriteCommand = {
      id: commandPrefix + 'addFavorite',
      options: {
        label: 'Add to bookmarks',
        caption: 'Add to bookmarks',
        execute: async (): Promise<any> => {
          const currentDoc = notebookTracker.currentWidget;
          const currentDocName = currentDoc.context.contentsModel.name;
          const currentDocPath = currentDoc.context.path;
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
    commands.addCommand(addFavoriteCommand.id, addFavoriteCommand.options);
    app.contextMenu.addItem({
      command: addFavoriteCommand.id,
      selector: '.jp-Notebook',
      rank: 10
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
      console.log(bookmarkItem);
      const commandId: string = bookmarkItem[0];
      const disabled = bookmarkItem[4] === 'True';
      console.log(disabled);
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
      launcher.add({
        command: commandPrefix + commandId,
        category: disabled ? 'Disabled bookmarks' : TITLE
      });
      console.log(commandPrefix + commandId + ' added to Launcher');
    }
  }
};

export default extension;
