// -- codemirror.js ----------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver2.01.0';
// ---------------------------------------------------------------------
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutter, keymap, placeholder } from '@codemirror/view';

export function createEditor(container, placeholderText, getSpeakerIcon = () => '') {
    const editableCompartment = new Compartment();
    const setLineSpeakerEffect = StateEffect.define();
    const setAllSpeakersEffect = StateEffect.define();
    let suppressInputEvent = false;
    let activeVertical = false;
    let isReadOnly = false;
    let verticalInput = null;
    let verticalGutter = null;
    class SpeakerMarker extends GutterMarker {
        constructor(icon) {
            super();
            this.icon = icon;
        }
        eq(other) {
            return other.icon === this.icon;
        }
        toDOM() {
            const marker = document.createElement('span');
            marker.className = 'cm-speaker-marker';
            marker.textContent = this.icon;
            return marker;
        }
    }
    const lineSpeakers = StateField.define({
        create: () => new Map(),
        update: (speakers, transaction) => {
            let nextSpeakers = speakers;
            if (transaction.docChanged) {
                nextSpeakers = new Map();
                for (const [position, speaker] of speakers) {
                    const mappedPosition = transaction.changes.mapPos(position, 1);
                    const lineStart = transaction.state.doc.lineAt(mappedPosition).from;
                    nextSpeakers.set(lineStart, speaker);
                }
            }
            for (const effect of transaction.effects) {
                if (effect.is(setLineSpeakerEffect)) {
                    const { line, speaker } = effect.value;
                    const lineStart = transaction.state.doc.line(line).from;
                    nextSpeakers = new Map(nextSpeakers);
                    if (speaker) nextSpeakers.set(lineStart, speaker);
                    else nextSpeakers.delete(lineStart);
                } else if (effect.is(setAllSpeakersEffect)) {
                    nextSpeakers = new Map();
                    effect.value.slice(0, transaction.state.doc.lines).forEach((speaker, index) => {
                        if (speaker) nextSpeakers.set(transaction.state.doc.line(index + 1).from, speaker);
                    });
                }
            }
            return nextSpeakers;
        }
    });
    const speakerGutter = gutter({
        class: 'cm-speaker-gutter',
        lineMarkerChange: update => update.transactions.some(transaction =>
            transaction.effects.some(effect =>
                effect.is(setLineSpeakerEffect) || effect.is(setAllSpeakersEffect)
            )
        ),
        lineMarker: (view, line) => {
            const speaker = view.state.field(lineSpeakers).get(line.from);
            const icon = speaker ? getSpeakerIcon(speaker) : '';
            return icon ? new SpeakerMarker(icon) : null;
        }
    });
    const getLineSpeakers = (state) => Array.from({ length: state.doc.lines }, (_, index) => {
        const line = state.doc.line(index + 1);
        return state.field(lineSpeakers).get(line.from) || null;
    });
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
                lineSpeakers,
                speakerGutter,
                editableCompartment.of(EditorView.editable.of(true)),
                playbackHighlight,
                EditorView.updateListener.of((update) => {
                    renderVerticalGutter();
                    if (update.docChanged && !suppressInputEvent) {
                        view.dom.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                })
            ]
        })
    });
    verticalInput = document.createElement('textarea');
    verticalInput.className = 'cm-vertical-input';
    verticalInput.placeholder = placeholderText;
    verticalInput.setAttribute('aria-label', 'テキスト入力');
    verticalInput.wrap = 'soft';
    verticalInput.hidden = true;
    container.appendChild(verticalInput);
    verticalGutter = document.createElement('div');
    verticalGutter.className = 'cm-vertical-gutter';
    verticalGutter.setAttribute('aria-hidden', 'true');
    verticalGutter.hidden = true;
    container.appendChild(verticalGutter);

    function renderVerticalGutter() {
        if (!verticalGutter || !verticalInput) return;
        const style = window.getComputedStyle(verticalInput);
        const text = verticalInput.value;
        const speakers = getLineSpeakers(view.state);
        const mirror = document.createElement('div');
        const markerAnchors = [];
        const stylesToCopy = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
            'lineHeight', 'textTransform', 'wordBreak', 'overflowWrap', 'whiteSpace',
            'padding', 'paddingInlineStart', 'boxSizing', 'direction', 'tabSize'
        ];
        stylesToCopy.forEach(property => { mirror.style[property] = style[property]; });
        mirror.style.position = 'absolute';
        mirror.style.top = '-100000px';
        mirror.style.left = '-100000px';
        mirror.style.visibility = 'hidden';
        mirror.style.overflow = 'hidden';
        mirror.style.height = `${verticalInput.clientHeight}px`;
        mirror.style.width = 'auto';
        mirror.style.writingMode = 'vertical-rl';
        mirror.style.webkitWritingMode = 'vertical-rl';
        mirror.style.border = '0';

        const lines = text.split('\n');
        lines.forEach((line, index) => {
            if (index > 0) mirror.appendChild(document.createTextNode('\n'));
            const speaker = speakers[index];
            const firstCharacter = Array.from(line)[0];
            if (speaker && getSpeakerIcon(speaker)) {
                const anchor = document.createElement('span');
                anchor.textContent = firstCharacter || '\u00a0';
                markerAnchors.push({ index, anchor });
                mirror.appendChild(anchor);
                if (firstCharacter) mirror.appendChild(document.createTextNode(line.slice(firstCharacter.length)));
            } else {
                mirror.appendChild(document.createTextNode(line));
            }
        });

        document.body.appendChild(mirror);
        const mirrorRect = mirror.getBoundingClientRect();
        const inputRect = verticalInput.getBoundingClientRect();
        const gutterRect = verticalGutter.getBoundingClientRect();
        const contentRightOffset = parseFloat(style.borderRightWidth) + parseFloat(style.paddingRight);
        const gutterAlignment = inputRect.right - contentRightOffset - gutterRect.right;
        verticalGutter.replaceChildren();
        markerAnchors.forEach(({ index, anchor }) => {
            const speaker = speakers[index];
            const icon = speaker ? getSpeakerIcon(speaker) : '';
            if (!icon) return;
            const anchorRect = anchor.getBoundingClientRect();
            const textCenterFromRight = mirror.scrollWidth
                - (anchorRect.left - mirrorRect.left + anchorRect.width / 2);
            const marker = document.createElement('span');
            marker.className = 'cm-vertical-speaker-marker';
            marker.textContent = icon;
            marker.style.fontSize = style.fontSize;
            marker.style.right = `${textCenterFromRight + verticalInput.scrollLeft + gutterAlignment}px`;
            verticalGutter.appendChild(marker);
        });
        verticalGutter.style.transform = `translateY(${-verticalInput.scrollTop}px)`;
        document.body.removeChild(mirror);
    }

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
                view.dispatch({
                    changes,
                    selection: includeSelection ? selection : undefined,
                    effects: changes ? setAllSpeakersEffect.of(getLineSpeakers(view.state)) : undefined
                });
            }
        } finally {
            suppressInputEvent = false;
        }
    }

    verticalInput.addEventListener('input', () => syncViewFromVertical(true));
    verticalInput.addEventListener('scroll', renderVerticalGutter);

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
            const speakers = getLineSpeakers(view.state);
            suppressInputEvent = true;
            try {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: text },
                    selection: { anchor: 0 },
                    effects: setAllSpeakersEffect.of(speakers)
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
        getPositionAtCoords(x, y) {
            if (container.classList.contains('is-vertical')) {
                const caretPosition = document.caretPositionFromPoint?.(x, y);
                if (caretPosition?.offsetNode === verticalInput) return caretPosition.offset;
                const caretRange = document.caretRangeFromPoint?.(x, y);
                if (caretRange?.startContainer === verticalInput) return caretRange.startOffset;
                return verticalInput.selectionStart;
            }
            return view.posAtCoords({ x, y }) ?? view.state.selection.main.head;
        },
        getLineSpeaker(lineIndex) {
            return getLineSpeakers(view.state)[lineIndex] || null;
        },
        getLineSpeakers() {
            return getLineSpeakers(view.state);
        },
        setLineSpeakers(speakers) {
            view.dispatch({ effects: setAllSpeakersEffect.of(speakers) });
        },
        setLineSpeaker(lineIndex, speaker) {
            if (lineIndex < 0 || lineIndex >= view.state.doc.lines) return;
            view.dispatch({ effects: setLineSpeakerEffect.of({ line: lineIndex + 1, speaker }) });
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
            verticalGutter.hidden = !isVertical;
            view.dom.hidden = isVertical;
            activeVertical = isVertical;
            renderVerticalGutter();
            if (isVertical) {
                if (directionChanged) verticalInput.focus({ preventScroll: true });
            } else {
                view.requestMeasure();
                if (directionChanged) view.contentDOM.focus({ preventScroll: true });
            }
        }
    };
}