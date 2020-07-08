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
import {IDisposable} from '@lumino/disposable';

const TITLE = 'Bookmarks';
const NOTEBOOK_FACTORY = 'Notebook';
const PLUGIN_ID = 'jupyterlab-bookmarks-extension:bookmarks';
/**
 * Data structure is Array of arrays => [[name, path in current JL root, absolute_path, temp_path, disabled]]
 */
let bookmarks: Array<Array<string>> = new Array<Array<string>>(); 
let settingsObject: ISettingRegistry.ISettings = null;
let bookmarkCommands: Map<string, IDisposable> = new Map<string, IDisposable>();
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
          let bookmarkItemJSON = await requestAPI<any>('getAbsPath',{
            method: 'GET',
            body: JSON.stringify([currentDocName, currentDocPath, '', '', 'False'])
          })
          if (!Boolean(bookmarkItemJSON.error)){
            let bookmarkItem = bookmarkItemJSON.bookmarkItem;
            bookmarks.push(bookmarkItem);
          }else{
            window.alert(`Failed to save bookmark.\n${bookmarkItemJSON.reason}`)
          }
          await settingsObject.set('bookmarks', bookmarks);
        }
      }
    };

    // Code for startup
    /**
     * Load the settings for this extension
     *
     * @param settings Extension settings
     */
    function loadSetting(settings: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      bookmarks = settings.get('bookmarks').composite as Array<Array<string>>;
    }

    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settingsRegistry.load(PLUGIN_ID)])
      .then(([, settings]) => {
        // Read the settings
        settingsObject = settings;
        loadSetting(settingsObject);

        // Listen for your plugin setting changes using Signal
        settingsObject.changed.connect(loadSetting);
        
        requestAPI<any>('startup',{
          method: 'POST',
          body: JSON.stringify({bookmarks_data: bookmarks})
        }).then(data => {
          bookmarks = data.bookmarks;
          bookmarks.forEach(itemArray => {
            let commandId: string = itemArray[0];
            let disabled: boolean = Boolean(itemArray[4]);
            if (commands.hasCommand(commandPrefix + commandId)){
              let commandToDelete=bookmarkCommands.get(commandId)
              if (commandToDelete !== undefined){
                commandToDelete.dispose();
                bookmarkCommands.delete(commandId);
              }
              
            }
            let commandPath:string = itemArray[1] === itemArray[2] ? itemArray[1] : itemArray[2];
            let commandDisposable = commands.addCommand(commandPrefix + commandId, {
              label: commandId,
              caption: commandId,
              icon: notebookIcon,
              execute: async () => {
                return commands.execute('docmanager:open', {
                  path: commandPath,
                  factory: NOTEBOOK_FACTORY
                });
              }
            });
            bookmarkCommands.set(commandId, commandDisposable);

            launcher.add({
              command: commandPrefix + commandId,
              category: disabled ? TITLE+' disabled bookmarks' : TITLE
            });
            console.log(commandPrefix + commandId + ' added to Launcher');
          });
          console.log(data);
        }).catch(reason => {
            window.alert(
              `Failed to load bookmarks from servers side during startup.\n${reason}`  
            );
    
            console.error(
              `Failed to load bookmarks from servers side during startup.\n${reason}`
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

  }
};

export default extension;
