# Auto Play

Auto Play is a Tampermonkey userscript for YouTube Shorts on desktop. It automatically moves to the next Short when the current video reaches the end.

## Features

- Auto Play ON/OFF toggle button
- Saved settings
- Adjustable delay before moving to the next Short
- Option to advance near the end of a Short or wait until the actual end
- Hotkey support
- Shadow DOM settings UI, so YouTube page styling is less likely to break the controls
- Debug mode for troubleshooting
- Settings panel with a close button
- Optional PayPal donation button

## Installation

### Install from GitHub

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open `auto-play.user.js` from this repository.
3. Click the **Raw** button.
4. Tampermonkey should open the install page.
5. Click **Install**.

### Manual install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new userscript.
3. Copy the contents of `auto-play.user.js` into the editor.
4. Save the script.
5. Open a YouTube Shorts page on desktop.

## Usage

- Click **Auto Play: ON/OFF** in the bottom-right corner to toggle the script.
- Right-click **Auto Play: ON/OFF** to show or hide the settings panel.
- Press **S** to show or hide the settings panel.
- Press **N** to toggle Auto Play on or off.

## Settings

- **Delay before next Short**: Wait before moving to the next Short after the script decides to advance.
- **Advance when this close to end**: Move to the next Short slightly before the current one ends, or disable this to wait until the end.
- **Hotkey N**: Enable or disable the N hotkey.
- **Debug Mode**: Show debug information in the settings panel and browser console.
- **Reset Settings**: Restore default settings.

## Notes

This script is intended for the desktop YouTube Shorts interface. YouTube may change its layout or player behavior at any time, so updates may be needed if the script stops working.

## License

MIT
