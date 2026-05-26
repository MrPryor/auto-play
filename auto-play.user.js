// ==UserScript==
// @name         Auto Play
// @namespace    http://tampermonkey.net/
// @version      7.4
// @description  Automatically moves to the next YouTube Short with Shadow DOM settings UI.
// @author       Mr_Pryor
// @license      MIT
// @homepageURL  https://github.com/MrPryor/auto-play
// @supportURL   https://github.com/MrPryor/auto-play/issues
// @match        https://www.youtube.com/shorts/*
// @match        https://youtube.com/shorts/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '7.4';
    const SCRIPT_NAME = 'Auto Play';
    const DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=552NJP5ZMFYEL';
    const ISSUE_URL = 'https://github.com/MrPryor/auto-play/issues';

    const CHECK_INTERVAL_MS = 300;
    const COOLDOWN_MS = 1500;
    const SCROLL_FALLBACK_DELAY_MS = 150;

    const STORAGE_KEYS = {
        enabled: 'autoPlayV73_enabled',
        nextDelayMs: 'autoPlayV73_nextDelayMs',
        endThresholdSeconds: 'autoPlayV73_endThresholdSeconds',
        advanceNearEndEnabled: 'autoPlayV73_advanceNearEndEnabled',
        hotkeyEnabled: 'autoPlayV73_hotkeyEnabled',
        debugEnabled: 'autoPlayV73_debugEnabled',
        panelVisible: 'autoPlayV73_panelVisible'
    };

    const DEFAULTS = {
        enabled: true,
        nextDelayMs: 100,
        endThresholdSeconds: 0.25,
        advanceNearEndEnabled: true,
        hotkeyEnabled: true,
        debugEnabled: false,
        panelVisible: false
    };

    const DELAY_OPTIONS = [
        { label: 'No delay', value: 0 },
        { label: '0.1 seconds', value: 100 },
        { label: '0.5 seconds', value: 500 },
        { label: '1 second', value: 1000 },
        { label: '2 seconds', value: 2000 },
        { label: '5 seconds', value: 5000 }
    ];

    const ADVANCE_THRESHOLD_OPTIONS = [
        { label: 'Disabled', value: 'disabled' },
        { label: '0.25 seconds', value: 0.25 },
        { label: '0.5 seconds', value: 0.5 },
        { label: '0.75 seconds', value: 0.75 },
        { label: '1 second', value: 1 },
        { label: '1.5 seconds', value: 1.5 },
        { label: '2 seconds', value: 2 }
    ];

    let settings = {
        enabled: GM_getValue(STORAGE_KEYS.enabled, DEFAULTS.enabled),
        nextDelayMs: GM_getValue(STORAGE_KEYS.nextDelayMs, DEFAULTS.nextDelayMs),
        endThresholdSeconds: GM_getValue(STORAGE_KEYS.endThresholdSeconds, DEFAULTS.endThresholdSeconds),
        advanceNearEndEnabled: GM_getValue(STORAGE_KEYS.advanceNearEndEnabled, DEFAULTS.advanceNearEndEnabled),
        hotkeyEnabled: GM_getValue(STORAGE_KEYS.hotkeyEnabled, DEFAULTS.hotkeyEnabled),
        debugEnabled: GM_getValue(STORAGE_KEYS.debugEnabled, DEFAULTS.debugEnabled),
        panelVisible: GM_getValue(STORAGE_KEYS.panelVisible, DEFAULTS.panelVisible)
    };

    let lastVideo = null;
    let lastAdvanceTime = 0;
    let pendingAdvance = false;
    let lastDebugMessage = 'Loaded';
    let lastVideoTime = 'No video found';

    let host = null;
    let shadowRoot = null;

    function isUsingDropdown() {
        if (!shadowRoot) {
            return false;
        }

        const activeElement = shadowRoot.activeElement;

        return activeElement && activeElement.tagName === 'SELECT';
    }

    function safeRenderUI() {
        if (isUsingDropdown()) {
            return;
        }

        renderUI();
    }

    function log(message) {
        lastDebugMessage = message;

        if (settings.debugEnabled) {
            console.log(`[${SCRIPT_NAME} ${SCRIPT_VERSION}] ${message}`);
            safeRenderUI();
        }
    }

    function saveSetting(key, value) {
        settings[key] = value;
        GM_setValue(STORAGE_KEYS[key], value);
        lastDebugMessage = `${key} = ${value}`;
        renderUI();
    }

    function saveMultipleSettings(values) {
        Object.entries(values).forEach(([key, value]) => {
            settings[key] = value;
            GM_setValue(STORAGE_KEYS[key], value);
        });

        lastDebugMessage = Object.entries(values)
            .map(([key, value]) => `${key} = ${value}`)
            .join(', ');

        renderUI();
    }

    function resetSettings() {
        settings = { ...DEFAULTS };

        Object.keys(settings).forEach(key => {
            GM_setValue(STORAGE_KEYS[key], settings[key]);
        });

        lastDebugMessage = 'Settings reset';
        renderUI();
    }

    function getCurrentVideo() {
        const videos = Array.from(document.querySelectorAll('video'));

        return videos.find(video => !video.paused && video.offsetParent !== null) ||
               videos.find(video => video.offsetParent !== null) ||
               videos[0] ||
               null;
    }

    function preventLoop(video) {
        if (!video) {
            return;
        }

        video.loop = false;
        video.removeAttribute('loop');
    }

    function clickNextButton() {
        const buttons = Array.from(document.querySelectorAll('button'));

        const nextButton = buttons.find(button => {
            const label = button.getAttribute('aria-label') || '';
            return label.toLowerCase().includes('next');
        });

        if (!nextButton) {
            return false;
        }

        nextButton.click();
        return true;
    }

    function pressArrowDown() {
        const eventOptions = {
            key: 'ArrowDown',
            code: 'ArrowDown',
            keyCode: 40,
            which: 40,
            bubbles: true
        };

        const keyDown = new KeyboardEvent('keydown', eventOptions);
        const keyUp = new KeyboardEvent('keyup', eventOptions);

        document.dispatchEvent(keyDown);
        window.dispatchEvent(keyDown);
        document.dispatchEvent(keyUp);
        window.dispatchEvent(keyUp);
    }

    function scrollToNextShort() {
        const now = Date.now();

        if (now - lastAdvanceTime < COOLDOWN_MS) {
            return;
        }

        lastAdvanceTime = now;

        if (clickNextButton()) {
            log('Advanced using Next button');
            return;
        }

        pressArrowDown();
        log('Advanced using ArrowDown');

        setTimeout(() => {
            window.scrollBy({
                top: window.innerHeight,
                behavior: 'smooth'
            });

            log('Advanced using scroll fallback');
        }, SCROLL_FALLBACK_DELAY_MS);
    }

    function scheduleNextShort() {
        if (pendingAdvance) {
            return;
        }

        pendingAdvance = true;
        lastDebugMessage = `Scheduling next Short in ${settings.nextDelayMs}ms`;

        if (settings.debugEnabled) {
            safeRenderUI();
        }

        setTimeout(() => {
            pendingAdvance = false;

            if (settings.enabled) {
                scrollToNextShort();
            }
        }, settings.nextDelayMs);
    }

    function shouldAdvance(video, remaining) {
        if (settings.advanceNearEndEnabled) {
            return remaining <= settings.endThresholdSeconds && video.currentTime > 1;
        }

        return video.ended || remaining <= 0.05;
    }

    function checkVideo() {
        ensureUI();

        const video = getCurrentVideo();

        if (video) {
            preventLoop(video);
        }

        if (!video || !video.duration || Number.isNaN(video.duration)) {
            lastVideoTime = 'No valid video duration';

            if (settings.debugEnabled) {
                safeRenderUI();
            }

            return;
        }

        const remaining = video.duration - video.currentTime;

        lastVideoTime =
            `Time: ${video.currentTime.toFixed(1)} / ${video.duration.toFixed(1)} | Remaining: ${remaining.toFixed(1)}s`;

        if (!settings.enabled) {
            pendingAdvance = false;

            if (settings.debugEnabled) {
                safeRenderUI();
            }

            return;
        }

        if (video !== lastVideo) {
            lastVideo = video;
            pendingAdvance = false;
            preventLoop(video);
            lastDebugMessage = 'Watching new video';

            if (settings.debugEnabled) {
                safeRenderUI();
            }
        }

        preventLoop(video);

        if (shouldAdvance(video, remaining)) {
            scheduleNextShort();
        } else if (settings.debugEnabled) {
            safeRenderUI();
        }
    }

    function stopEvent(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    function openDonatePage() {
        window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
    }

    function openIssuePage() {
        window.open(ISSUE_URL, '_blank', 'noopener,noreferrer');
    }

    function removeOldUI() {
        const oldIds = [
            'yt-shorts-auto-next-debug-v4-container',
            'yt-shorts-auto-next-debug-v4-panel',
            'yt-shorts-auto-next-debug-v4-toggle',
            'yt-shorts-auto-next-debug-v4-version',
            'yt-shorts-auto-next-debug-v41-container',
            'yt-shorts-auto-next-debug-v41-panel',
            'yt-shorts-auto-next-debug-v41-toggle',
            'yt-shorts-auto-next-debug-v41-version',
            'yt-shorts-auto-next-debug-v42-panel',
            'yt-shorts-auto-next-debug-v42-badge',
            'yt-shorts-auto-next-debug-v42-button',
            'yt-shorts-auto-next-debug-v50-panel',
            'yt-shorts-auto-next-debug-v50-badge',
            'yt-shorts-auto-next-debug-v50-button',
            'yt-shorts-auto-next-debug-v60-host',
            'yt-shorts-auto-next-v61-host',
            'yt-shorts-auto-next-v62-host',
            'yt-shorts-auto-next-v63-host',
            'yt-shorts-auto-next-v64-host',
            'yt-shorts-auto-next-v65-host',
            'yt-shorts-auto-next-v66-host',
            'yt-shorts-auto-next-v67-host',
            'auto-play-v68-host',
            'auto-play-v69-host',
            'auto-play-v70-host',
            'auto-play-v71-host',
            'auto-play-v72-host',
            'auto-play-v73-host'
        ];

        oldIds.forEach(id => {
            const element = document.getElementById(id);

            if (element) {
                element.remove();
            }
        });
    }

    function createHost() {
        removeOldUI();

        host = document.createElement('div');
        host.id = 'auto-play-v73-host';

        host.style.position = 'fixed';
        host.style.right = '16px';
        host.style.bottom = '18px';
        host.style.zIndex = '2147483647';
        host.style.pointerEvents = 'auto';

        document.documentElement.appendChild(host);

        shadowRoot = host.attachShadow({ mode: 'open' });

        renderUI();
        log(`Script loaded version ${SCRIPT_VERSION}`);
    }

    function ensureUI() {
        if (!document.documentElement) {
            return;
        }

        if (!document.getElementById('auto-play-v73-host')) {
            createHost();
        }
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = text;
        }

        return element;
    }

    function createButton(text, active, onClick) {
        const button = createElement('button', active ? 'menu-button active' : 'menu-button', text);

        button.addEventListener('click', event => {
            stopEvent(event);
            onClick();
        });

        return button;
    }

    function createSelect(options, selectedValue, onChange) {
        const select = createElement('select', 'select');

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = String(option.value);
            optionElement.textContent = option.label;

            if (String(option.value) === String(selectedValue)) {
                optionElement.selected = true;
            }

            select.appendChild(optionElement);
        });

        select.addEventListener('mousedown', event => {
            event.stopPropagation();
        });

        select.addEventListener('click', event => {
            event.stopPropagation();
        });

        select.addEventListener('change', () => {
            onChange(select.value);
        });

        return select;
    }

    function addInfo(panel, text) {
        panel.appendChild(createElement('div', 'info-line', text));
    }

    function addLabel(panel, text) {
        panel.appendChild(createElement('div', 'label', text));
    }

    function buildPanelHeader(panel) {
        const panelHeader = createElement('div', 'panel-header');
        const title = createElement('div', 'title', SCRIPT_NAME);
        const closeButton = createElement('button', 'close-button', '×');

        closeButton.type = 'button';
        closeButton.title = 'Close settings';

        closeButton.addEventListener('click', event => {
            stopEvent(event);
            saveSetting('panelVisible', false);
        });

        panelHeader.appendChild(title);
        panelHeader.appendChild(closeButton);
        panel.appendChild(panelHeader);
    }

    function buildDebugInfo(panel) {
        if (!settings.debugEnabled) {
            return;
        }

        panel.appendChild(createElement('div', 'section-title', 'Debug Info'));
        addInfo(panel, `Version: ${SCRIPT_VERSION}`);
        addInfo(panel, 'Author: Mr_Pryor');
        addInfo(panel, `Status: ${settings.enabled ? 'Enabled' : 'Disabled'}`);
        addInfo(panel, lastVideoTime);
        addInfo(panel, `Last message: ${lastDebugMessage}`);
    }

    function buildDelaySetting(panel) {
        addLabel(panel, 'Delay before next Short');

        panel.appendChild(createSelect(DELAY_OPTIONS, settings.nextDelayMs, value => {
            saveSetting('nextDelayMs', Number(value));
        }));
    }

    function buildAdvanceThresholdSetting(panel) {
        addLabel(panel, 'Advance when this close to end');

        const selectedValue = settings.advanceNearEndEnabled
            ? settings.endThresholdSeconds
            : 'disabled';

        panel.appendChild(createSelect(ADVANCE_THRESHOLD_OPTIONS, selectedValue, value => {
            if (value === 'disabled') {
                saveSetting('advanceNearEndEnabled', false);
                return;
            }

            saveMultipleSettings({
                advanceNearEndEnabled: true,
                endThresholdSeconds: Number(value)
            });
        }));
    }

    function buildSettings(panel) {
        panel.appendChild(createElement('div', 'section-title', 'Settings'));

        buildDelaySetting(panel);
        buildAdvanceThresholdSetting(panel);

        panel.appendChild(createButton(
            settings.hotkeyEnabled ? 'Hotkey N: ON' : 'Hotkey N: OFF',
            settings.hotkeyEnabled,
            () => saveSetting('hotkeyEnabled', !settings.hotkeyEnabled)
        ));

        panel.appendChild(createButton(
            settings.debugEnabled ? 'Debug Mode: ON' : 'Debug Mode: OFF',
            settings.debugEnabled,
            () => saveSetting('debugEnabled', !settings.debugEnabled)
        ));

        panel.appendChild(createButton(
            'Reset Settings',
            false,
            () => resetSettings()
        ));

        panel.appendChild(createElement(
            'div',
            'hint',
            'Press S to show/hide settings. Press N to toggle Auto Play. Right-click Auto Play to show/hide settings.'
        ));
    }

    function buildFooter(panel) {
        const footer = createElement('div', 'panel-footer');

        const reportButton = createElement('button', 'report-button', 'Report Issue');
        reportButton.type = 'button';
        reportButton.title = 'Report an issue on GitHub';

        reportButton.addEventListener('click', event => {
            stopEvent(event);
            openIssuePage();
        });

        const donateButton = createElement('button', 'donate-button', 'Donate');
        donateButton.type = 'button';
        donateButton.title = 'Donate with PayPal';

        donateButton.addEventListener('click', event => {
            stopEvent(event);
            openDonatePage();
        });

        footer.appendChild(reportButton);
        footer.appendChild(donateButton);
        panel.appendChild(footer);
    }

    function createMainButton() {
        const mainButton = createElement(
            'button',
            'main-button',
            settings.enabled ? 'Auto Play: ON' : 'Auto Play: OFF'
        );

        mainButton.addEventListener('click', event => {
            stopEvent(event);
            saveSetting('enabled', !settings.enabled);
        });

        mainButton.addEventListener('contextmenu', event => {
            stopEvent(event);
            saveSetting('panelVisible', !settings.panelVisible);
        });

        return mainButton;
    }

    function getStyles() {
        return `
            :host {
                all: initial;
                font-family: Arial, sans-serif;
                color: white;
            }

            .wrapper {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 8px;
                pointer-events: auto;
            }

            .panel {
                position: absolute;
                right: 0;
                bottom: 58px;
                width: 360px;
                max-height: 76vh;
                overflow-y: auto;
                padding: 12px;
                border-radius: 16px;
                background: rgba(20, 20, 20, 0.98);
                color: white;
                border: 3px solid #ff0033;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.65);
                display: ${settings.panelVisible ? 'block' : 'none'};
                box-sizing: border-box;
            }

            .panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 8px;
            }

            .title {
                font-size: 16px;
                font-weight: 700;
            }

            .close-button {
                border: none;
                border-radius: 999px;
                color: white;
                background: rgba(255, 0, 51, 0.92);
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
                width: 26px;
                height: 26px;
                line-height: 26px;
                padding: 0;
                text-align: center;
                flex: 0 0 auto;
            }

            .close-button:hover,
            .donate-button:hover,
            .report-button:hover {
                background: rgba(255, 0, 51, 1);
            }

            .main-button {
                border: none;
                border-radius: 999px;
                color: white;
                font-size: 14px;
                font-weight: 700;
                padding: 12px 18px;
                cursor: pointer;
                min-width: 150px;
                background: ${settings.enabled ? 'rgba(0, 128, 0, 0.92)' : 'rgba(128, 128, 128, 0.92)'};
                box-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
                pointer-events: auto;
            }

            .menu-button {
                width: 100%;
                margin: 5px 0;
                padding: 8px 10px;
                border: none;
                border-radius: 10px;
                color: white;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                background: rgba(80, 80, 80, 0.95);
                box-sizing: border-box;
            }

            .menu-button.active {
                background: rgba(0, 128, 0, 0.9);
            }

            .select {
                width: 100%;
                margin: 4px 0;
                padding: 8px;
                border: none;
                border-radius: 10px;
                color: white;
                background: rgba(80, 80, 80, 0.95);
                font-size: 13px;
                box-sizing: border-box;
            }

            .section-title {
                font-size: 13px;
                font-weight: 700;
                margin: 10px 0 6px 0;
                opacity: 0.95;
            }

            .info-line {
                font-size: 12px;
                opacity: 0.82;
                margin: 4px 0;
                word-break: break-word;
            }

            .label {
                font-size: 12px;
                font-weight: 700;
                opacity: 0.9;
                margin: 10px 0 4px 0;
            }

            .hint {
                font-size: 11px;
                opacity: 0.7;
                margin-top: 6px;
                line-height: 1.35;
            }

            .panel-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin-top: 10px;
            }

            .donate-button,
            .report-button {
                border: none;
                border-radius: 999px;
                color: white;
                background: rgba(255, 0, 51, 0.92);
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                padding: 6px 10px;
                line-height: 1;
            }
        `;
    }

    function renderUI() {
        if (!shadowRoot) {
            return;
        }

        shadowRoot.textContent = '';

        const style = document.createElement('style');
        style.textContent = getStyles();

        const wrapper = createElement('div', 'wrapper');
        const panel = createElement('div', 'panel');

        buildPanelHeader(panel);
        buildDebugInfo(panel);
        buildSettings(panel);
        buildFooter(panel);

        wrapper.appendChild(panel);
        wrapper.appendChild(createMainButton());

        shadowRoot.appendChild(style);
        shadowRoot.appendChild(wrapper);
    }

    document.addEventListener('keydown', event => {
        const activeElement = document.activeElement;

        const isTyping =
            activeElement &&
            (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            );

        if (isTyping) {
            return;
        }

        if (
            settings.hotkeyEnabled &&
            event.key.toLowerCase() === 'n' &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
        ) {
            saveSetting('enabled', !settings.enabled);
        }

        if (
            event.key.toLowerCase() === 's' &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
        ) {
            saveSetting('panelVisible', !settings.panelVisible);
        }
    });

    setInterval(checkVideo, CHECK_INTERVAL_MS);
    setInterval(ensureUI, 1000);

    window.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            ensureUI();

            const video = getCurrentVideo();

            if (video) {
                preventLoop(video);
            }
        }, 500);
    });

    createHost();
})();
