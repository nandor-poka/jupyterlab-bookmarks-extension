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

const TITLE = '';
const NOTEBOOK_FACTORY = 'Notebook';
const PLUGIN_ID = 'jupyterlab-bookmarks-extension:bookmarks';
let bookmarks: Array<Array<string>> = new Array<Array<string>>();
let settingsObject: ISettingRegistry.ISettings = null;
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
          bookmarks.push([currentDocName, currentDocPath]);

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
      bookmarks.forEach(itemArray => {
        commands.addCommand(commandPrefix + itemArray[0], {
          label: itemArray[0],
          caption: itemArray[0],
          icon: notebookIcon,
          execute: async () => {
            return commands.execute('docmanager:open', {
              path: itemArray[1],
              factory: NOTEBOOK_FACTORY
            });
          }
        });
        launcher.add({
          command: commandPrefix + itemArray[0],
          category: TITLE
        });
      });
      console.log('JupyterLab bookmarks settings loaded.');
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
      })
      .catch(reason => {
        window.alert(
          `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
        );
        console.error(
          `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
        );
      });

    commands.addCommand(addFavoriteCommand.id, addFavoriteCommand.options);
    app.contextMenu.addItem({
      command: addFavoriteCommand.id,
      selector: '.jp-Notebook',
      rank: 10
    });

    console.log(
      'JupyterLab extension jupyterlab-bookmarks-extension is activated!'
    );

    requestAPI<any>('startup')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_bookmarks_extension server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default extension;
