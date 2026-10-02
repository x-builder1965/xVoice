// -- codemirror.js ----------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver2.00.0';
// ---------------------------------------------------------------------
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, StateField } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder } from '@codemirror/view';

export function createEditor(container, placeholderText) {
    const editableCompartment = new Compartment();
    let suppressInputEvent = false;
    let activeVertical = false;
    let isReadOnly = false;
    const playbackHighlight = StateField.define({
        create: () => Decoration.none,
        update: (_decorations, transaction) => {
            const selection = transaction.state.selection.main;
            return selection.empty
                ? Decoration.none
                : Decoration.set([Decoration.mark({ class: 'cm-playback-highlight' }).range(selection.from, selection.to)]);
        },
        provide: (field) => EditorView.decorations.from(field)
    });
    const view = new EditorView({
        parent: container,
        state: EditorState.create({
            extensions: [
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                EditorView.lineWrapping,
                placeholder(placeholderText),
                editableCompartment.of(EditorView.editable.of(true)),
                playbackHighlight,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !suppressInputEvent) {
                        view.dom.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                })
            ]
        })
    });
    const verticalInput = document.createElement('textarea');
    verticalInput.className = 'cm-vertical-input';
    verticalInput.placeholder = placeholderText;
    verticalInput.setAttribute('aria-label', 'テキスト入力');
    verticalInput.wrap = 'soft';
    verticalInput.hidden = true;
    container.appendChild(verticalInput);

    function syncViewFromVertical(includeSelection = false) {
        const text = verticalInput.value;
        const selection = {
            anchor: verticalInput.selectionStart,
            head: verticalInput.selectionEnd
        };
        suppressInputEvent = true;
        try {
            const changes = text === view.state.doc.toString()
                ? undefined
                : { from: 0, to: view.state.doc.length, insert: text };
            if (changes || includeSelection) {
                view.dispatch({ changes, selection: includeSelection ? selection : undefined });
            }
        } finally {
            suppressInputEvent = false;
        }
    }

    verticalInput.addEventListener('input', () => syncViewFromVertical(true));

    return {
        get value() {
            return container.classList.contains('is-vertical')
                ? verticalInput.value
                : view.state.doc.toString();
        },
        set value(value) {
            const text = String(value ?? '');
            verticalInput.value = text;
            verticalInput.setSelectionRange(0, 0);
            suppressInputEvent = true;
            try {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: text },
                    selection: { anchor: 0 }
                });
            } finally {
                suppressInputEvent = false;
            }
        },
        get selectionStart() {
            return container.classList.contains('is-vertical')
                ? verticalInput.selectionStart
                : view.state.selection.main.from;
        },
        get selectionEnd() {
            return container.classList.contains('is-vertical')
                ? verticalInput.selectionEnd
                : view.state.selection.main.to;
        },
        get scrollTop() {
            return container.classList.contains('is-vertical')
                ? verticalInput.scrollTop
                : view.scrollDOM.scrollTop;
        },
        set scrollTop(value) {
            if (container.classList.contains('is-vertical')) verticalInput.scrollTop = value;
            else view.scrollDOM.scrollTop = value;
        },
        get scrollLeft() {
            return container.classList.contains('is-vertical')
                ? verticalInput.scrollLeft
                : view.scrollDOM.scrollLeft;
        },
        set scrollLeft(value) {
            if (container.classList.contains('is-vertical')) verticalInput.scrollLeft = value;
            else view.scrollDOM.scrollLeft = value;
        },
        get style() {
            return container.classList.contains('is-vertical')
                ? verticalInput.style
                : view.dom.style;
        },
        get classList() {
            return container.classList;
        },
        get dom() {
            return container.classList.contains('is-vertical') ? verticalInput : view.dom;
        },
        get isNative() {
            return container.classList.contains('is-vertical');
        },
        get readOnly() {
            return isReadOnly;
        },
        set readOnly(value) {
            isReadOnly = Boolean(value);
            verticalInput.readOnly = isReadOnly;
            view.dom.classList.toggle('cm-playback-mode', isReadOnly);
            view.dispatch({
                effects: editableCompartment.reconfigure(EditorView.editable.of(!isReadOnly))
            });
        },
        addEventListener(type, listener, options) {
            view.dom.addEventListener(type, listener, options);
            verticalInput.addEventListener(type, listener, options);
        },
        dispatchEvent(event) {
            const activeElement = container.classList.contains('is-vertical') ? verticalInput : view.dom;
            return activeElement.dispatchEvent(event);
        },
        focus(options) {
            if (container.classList.contains('is-vertical')) verticalInput.focus(options);
            else view.contentDOM.focus(options);
        },
        setSelectionRange(start, end = start) {
            if (container.classList.contains('is-vertical')) {
                verticalInput.setSelectionRange(start, end);
            } else {
                view.dispatch({
                    selection: { anchor: start, head: end },
                    scrollIntoView: true
                });
            }
        },
        replaceSelection(text) {
            if (container.classList.contains('is-vertical')) {
                verticalInput.setRangeText(text, verticalInput.selectionStart, verticalInput.selectionEnd, 'end');
                verticalInput.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
            const selection = view.state.selection.main;
            view.dispatch({
                changes: { from: selection.from, to: selection.to, insert: text },
                selection: { anchor: selection.from + text.length },
                scrollIntoView: true,
                userEvent: 'input'
            });
        },
        requestMeasure() {
            const isVertical = container.classList.contains('is-vertical');
            const directionChanged = isVertical !== activeVertical;
            if (isVertical) {
                verticalInput.value = view.state.doc.toString();
                verticalInput.classList.add('is-vertical');
                const selection = view.state.selection.main;
                verticalInput.setSelectionRange(selection.from, selection.to);
                if (!activeVertical) {
                    const style = window.getComputedStyle(view.dom);
                    verticalInput.style.fontFamily = style.fontFamily;
                    verticalInput.style.fontSize = style.fontSize;
                    verticalInput.style.fontWeight = style.fontWeight;
                    verticalInput.style.fontStyle = style.fontStyle;
                    verticalInput.style.cursor = view.dom.style.cursor;
                }
            } else if (activeVertical) {
                syncViewFromVertical(true);
                view.dom.style.fontFamily = verticalInput.style.fontFamily;
                view.dom.style.fontSize = verticalInput.style.fontSize;
                view.dom.style.fontWeight = verticalInput.style.fontWeight;
                view.dom.style.fontStyle = verticalInput.style.fontStyle;
                view.dom.style.cursor = verticalInput.style.cursor;
            }
            verticalInput.hidden = !isVertical;
            view.dom.hidden = isVertical;
            activeVertical = isVertical;
            if (isVertical) {
                if (directionChanged) verticalInput.focus({ preventScroll: true });
            } else {
                view.requestMeasure();
                if (directionChanged) view.contentDOM.focus({ preventScroll: true });
            }
        }
    };
}