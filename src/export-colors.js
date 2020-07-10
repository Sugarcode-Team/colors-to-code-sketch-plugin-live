import sketch from 'sketch'
const Settings = require('sketch/settings');
const UI = require('sketch/ui')
const fetch = require("sketch-polyfill-fetch");
const fs = require("@skpm/fs");
const HOST = 'http://127.0.0.1';
import BrowserWindow from 'sketch-module-web-view'
import { getWebview } from 'sketch-module-web-view/remote'
import dialog from '@skpm/dialog'

const webviewIdentifier = 'colortocode.webview'

export default function () {

  const options = {
    identifier: webviewIdentifier,
    width: 400,
    minWidth: 400,
    maxWidth: 400,
    height: 800,
    minHeight: 800,
    maxHeight: 800,
    alwaysOnTop: true,
    show: false
  }

  const browserWindow = new BrowserWindow(options)
  // only show the window when the page has loaded to avoid a white flash
  browserWindow.once('ready-to-show', () => {
    browserWindow.show()
  })

  const webContents = browserWindow.webContents

  webContents.on('openUrl', url => {
    NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url));
  })

  // print a message when the page loads
  webContents.on('did-finish-load', () => {
    onSelection()
    var theme = UI.getTheme()
    webContents
        .executeJavaScript(`setInit(${JSON.stringify({theme})})`)
        .catch(console.error)
  })

  // add a handler for a call from web content's javascript
  webContents.on('nativeLog', s => {
    console.log('NATIVE LOG', s)
  })

  // add a handler for a call from web content's javascript
  webContents.on('getZip', (data) => {
    console.log(data)
    const json = JSON.parse(data);
    const url = json.url;
    const options = json.options;
    fetch(url, options).then(resp => {
      if (resp.status === 200) {
        return resp.arrayBuffer();
      }
      return null;
    }).then(buffer => {

      // Let user choose export directory
      let exportPath = '';
      const selected = dialog.showOpenDialogSync({
        title: 'Choose Export Directory',
        properties: ['openDirectory'],
        buttonLabel: 'Export Here'
      });

      // End early if they click cancel
      if (!selected.length) {
        webContents
            .executeJavaScript(`finishExport()`)
            .catch(console.error)
        return
      } else {
        exportPath = selected + '/sketch_colors_export.zip'
      }

      webContents
          .executeJavaScript(`finishExport()`)
          .catch(console.error)

      fs.writeFileSync(exportPath, buffer)

    }).catch(error => {
      webContents
          .executeJavaScript(`finishExport()`)
          .catch(console.error)
    })
  })

  browserWindow.loadURL(require('../resources/webview.html'))
}

// When the plugin is shutdown by Sketch (for example when the user disable the plugin)
// we need to close the webview if it's open
export function onShutdown() {
  const existingWebview = getWebview(webviewIdentifier)
  if (existingWebview) {
    existingWebview.close()
  }
}

const getWindow = () => {
  return BrowserWindow.fromId(webviewIdentifier);
};

function onSelection(context) {
  const colors = getSelectedItems()
  const browserWindow = getWindow()
  const webContents = browserWindow.webContents
  webContents
      .executeJavaScript(`setData(${JSON.stringify(colors)})`)
      .catch(console.error)
}

export function onSelectionChanged(context){
  try{
    onSelection(context)
  }catch(e){
    //console.log('SELECTION ERROR', e.message, e.stack)
  }
}

const getSelectedItems = () => {
  const document = sketch.getSelectedDocument();
  const selectedPage = document.pages.find(page => page.selected);
  const colors = [];

  selectedPage.layers.forEach((item) => {
    if(item.selected){
      const { fills } = item.style
      if(fills.length > 0){
        colors.push({name: item.name, hex: fills[0].color.replace('#','')})
      }
    }
  });
  console.log('COLORS', colors)
  return colors;
}
