// Inked+ for macOS — Complete SwiftUI rewrite matching the HTML/Electron UI
// Single-file, no dependencies. Requires macOS 13+.
// Add to Info.plist: NSSpeechRecognitionUsageDescription, NSMicrophoneUsageDescription

import SwiftUI
import AppKit
import Speech
import AVFoundation

// MARK: - Theme

extension Color {
    static let inkBlack      = Color(hex: "#000000")
    static let inkZinc900    = Color(hex: "#18181b")
    static let inkZinc800    = Color(hex: "#27272a")
    static let inkZinc700    = Color(hex: "#3f3f46")
    static let inkZinc600    = Color(hex: "#52525b")
    static let inkZinc500    = Color(hex: "#71717a")
    static let inkZinc400    = Color(hex: "#a1a1aa")
    static let inkZinc300    = Color(hex: "#d4d4d8")
    static let inkZinc200    = Color(hex: "#e4e4e7")
    static let inkZinc100    = Color(hex: "#f4f4f5")
    static let inkRed900     = Color(hex: "#7f1d1d")
    static let inkRed800     = Color(hex: "#991b1b")
    static let inkAmber      = Color(hex: "#fbbf24")
    static let inkBorder     = Color(hex: "#27272a").opacity(0.5)

    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Models

struct Notebook: Identifiable, Codable, Equatable, Hashable {
    var id: String = UUID().uuidString
    var name: String
}

struct Note: Identifiable, Codable, Equatable {
    var id: String = UUID().uuidString
    var title: String = ""
    var content: String = ""
    var rtfData: Data?
    var notebookId: String
    var starred: Bool = false
    var tags: [String] = []
    var reminderAt: Date?
    var deletedAt: Date?
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
}

// MARK: - Store

final class AppStore: ObservableObject {
    @Published var notebooks: [Notebook] = []
    @Published var notes: [Note] = []

    private let nbKey = "ink-notebooks-v2"
    private let ntKey = "ink-notes-v2"
    private let persistenceQueue = DispatchQueue(label: "inked.store.persistence", qos: .utility)

    init() {
        load()
        if notebooks.isEmpty {
            notebooks = [
                Notebook(id: "1", name: "THINGS THAT NEEDS FIX"),
                Notebook(id: "2", name: "TAPASHYAS STUFF"),
                Notebook(id: "3", name: "AAHANS MEAL PLAN"),
                Notebook(id: "4", name: "BACKUP PLAN"),
                Notebook(id: "5", name: "SHOPPING LIST"),
                Notebook(id: "6", name: "OOO"),
                Notebook(id: "7", name: "WORK RELATED"),
                Notebook(id: "8", name: "FAFSA"),
                Notebook(id: "9", name: "BABY NAMES :"),
                Notebook(id: "10", name: "CALORIE INTAKE"),
                Notebook(id: "11", name: "INTERVIEW PREPARATION"),
                Notebook(id: "12", name: "BUYING THE JEEP"),
            ]
            notes = [
                Note(id: "n1", title: "Lets get this straight", content: "But I think we need to reconsider the whole approach.", notebookId: "1", createdAt: Date().addingTimeInterval(-2*86400), updatedAt: Date().addingTimeInterval(-2*86400)),
                Note(id: "n2", title: "when i get a AI respons...", content: "also when i share this in safari and chrome it does not work", notebookId: "1", createdAt: Date().addingTimeInterval(-14*86400), updatedAt: Date().addingTimeInterval(-14*86400)),
                Note(id: "n3", title: "TOYOTA RAV 4 OR SIMILAR", content: "FORD EDGE OR SIMILAR - 309", notebookId: "1", starred: true, createdAt: Date().addingTimeInterval(-60*86400), updatedAt: Date().addingTimeInterval(-60*86400)),
            ]
            save()
        }
    }

    func save() {
        let notebooksSnapshot = notebooks
        let notesSnapshot = notes
        let nbKey = self.nbKey
        let ntKey = self.ntKey

        persistenceQueue.async {
            if let d = try? JSONEncoder().encode(notebooksSnapshot) {
                UserDefaults.standard.set(d, forKey: nbKey)
            }
            if let d = try? JSONEncoder().encode(notesSnapshot) {
                UserDefaults.standard.set(d, forKey: ntKey)
            }
        }
    }

    private func load() {
        if let d = UserDefaults.standard.data(forKey: nbKey), let v = try? JSONDecoder().decode([Notebook].self, from: d) { notebooks = v }
        if let d = UserDefaults.standard.data(forKey: ntKey), let v = try? JSONDecoder().decode([Note].self, from: d)     { notes = v }
    }

    func notesFor(notebookId: String?, tag: String?, starred: Bool, trash: Bool) -> [Note] {
        notes.filter { note in
            guard trash ? (note.deletedAt != nil) : (note.deletedAt == nil) else { return false }
            if starred { return note.starred }
            if let t = tag { return note.tags.contains(t) }
            if let nb = notebookId { return note.notebookId == nb }
            return true
        }.sorted { $0.updatedAt > $1.updatedAt }
    }

    var allTags: [String] {
        Array(Set(notes.filter { $0.deletedAt == nil }.flatMap { $0.tags })).sorted()
    }

    func addNotebook(name: String) {
        notebooks.append(Notebook(name: name))
        save()
    }

    func deleteNotebook(id: String) {
        notebooks.removeAll { $0.id == id }
        notes.removeAll { $0.notebookId == id }
        save()
    }

    func addNote(notebookId: String) -> String {
        let n = Note(title: "Untitled", content: "", notebookId: notebookId)
        notes.insert(n, at: 0)
        save()
        return n.id
    }

    func updateNote(id: String, title: String? = nil, content: String? = nil, rtfData: Data? = nil, starred: Bool? = nil, tags: [String]? = nil, reminderAt: Date?? = nil, deletedAt: Date?? = nil) {
        guard let i = notes.firstIndex(where: { $0.id == id }) else { return }
        if let v = title    { notes[i].title = v }
        if let v = content  { notes[i].content = v }
        if let v = rtfData  { notes[i].rtfData = v }
        if let v = starred  { notes[i].starred = v }
        if let v = tags     { notes[i].tags = v }
        if let v = reminderAt { notes[i].reminderAt = v }
        if let v = deletedAt  { notes[i].deletedAt = v }
        notes[i].updatedAt = Date()
        save()
    }

    func softDelete(id: String) {
        updateNote(id: id, deletedAt: Date())
    }

    func restore(id: String) {
        updateNote(id: id, deletedAt: nil as Date?)
    }

    func permanentDelete(id: String) {
        notes.removeAll { $0.id == id }
        save()
    }
}

// MARK: - Voice Recognizer

@MainActor
final class VoiceRecognizer: ObservableObject {
    @Published var isRecording = false
    @Published var interimText = ""

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    var onFinalResult: ((String) -> Void)?

    func toggle() {
        if isRecording { stop() } else { start() }
    }

    private func start() {
        let status = SFSpeechRecognizer.authorizationStatus()
        switch status {
        case .authorized:
            beginSession()
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { [weak self] newStatus in
                guard newStatus == .authorized else { return }
                DispatchQueue.main.async {
                    self?.beginSession()
                }
            }
        default:
            // denied / restricted – user must change this in System Settings
            break
        }
    }

    private func beginSession() {
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        request = req

        let input = audioEngine.inputNode
        let fmt = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buf, _ in
            self?.request?.append(buf)
        }

        do {
            try audioEngine.start()
        } catch {
            return
        }

        task = recognizer?.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }

            if let r = result {
                let txt = r.bestTranscription.formattedString
                if r.isFinal {
                    // Final transcript once per session
                    self.interimText = ""
                    self.onFinalResult?(txt)
                    self.stop()
                } else {
                    // Lightweight interim text for UI-only use
                    self.interimText = txt
                }
            }

            // On error, stop cleanly instead of looping
            if error != nil {
                self.stop()
            }
        }
        isRecording = true
    }

    func stop() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isRecording = false
        interimText = ""
    }
}

// MARK: - Rich Text Editor (NSViewRepresentable)

struct RichTextEditor: NSViewRepresentable {
    @Binding var rtfData: Data?
    @Binding var plainText: String
    var onWordCount: (Int, Int) -> Void
    var formatCommand: FormatCommand?
    var insertText: String?
    var fontName: String = "Poppins"
    var formatVersion: Int = 0

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        let tv = NSTextView()
        tv.delegate = context.coordinator
        tv.isEditable = true
        tv.isRichText = true
        tv.allowsUndo = true
        tv.backgroundColor = NSColor(Color.inkBlack)
        tv.textColor = NSColor(Color.inkZinc300)
        tv.insertionPointColor = .white
        tv.typingAttributes = defaultTypingAttributes()
        tv.textContainerInset = NSSize(width: 8, height: 16)
        tv.isAutomaticSpellingCorrectionEnabled = false
        tv.isAutomaticQuoteSubstitutionEnabled = false
        tv.isAutomaticDashSubstitutionEnabled = false
        scroll.hasVerticalScroller = true
        scroll.documentView = tv
        scroll.backgroundColor = NSColor(Color.inkBlack)
        scroll.drawsBackground = true
        context.coordinator.textView = tv
        // Load initial content
        if let d = rtfData, let as_ = NSAttributedString(rtf: d, documentAttributes: nil) {
            tv.textStorage?.setAttributedString(as_)
        } else if !plainText.isEmpty {
            tv.string = plainText
            tv.textStorage?.addAttributes(defaultTypingAttributes(), range: NSRange(location: 0, length: tv.string.count))
        }
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        guard let tv = scroll.documentView as? NSTextView else { return }
        // Handle format commands (use version to allow repeated toggles)
        if let cmd = formatCommand, formatVersion != context.coordinator.lastVersion {
            context.coordinator.lastVersion = formatVersion
            applyFormat(cmd, to: tv)
        }
        // Handle text insertion (voice)
        if let txt = insertText, txt != context.coordinator.lastInsert {
            context.coordinator.lastInsert = txt
            insertAtCursor(txt, in: tv)
        }
    }

    private func defaultTypingAttributes() -> [NSAttributedString.Key: Any] {
        let para = NSMutableParagraphStyle()
        para.lineSpacing = 6
        let baseFont = NSFont(name: fontName, size: 15) ?? NSFont.systemFont(ofSize: 15, weight: .light)
        return [
            .font: baseFont,
            .foregroundColor: NSColor(Color.inkZinc300),
            .paragraphStyle: para,
        ]
    }

    private func insertAtCursor(_ text: String, in tv: NSTextView) {
        let loc = tv.selectedRange().location
        let insertStr = (loc > 0 ? " " : "") + text + " "
        let attrs = tv.typingAttributes
        let as_ = NSAttributedString(string: insertStr, attributes: attrs)
        tv.textStorage?.insert(as_, at: loc)
        tv.setSelectedRange(NSRange(location: loc + as_.length, length: 0))
        tv.delegate?.textDidChange?(Notification(name: NSText.didChangeNotification, object: tv))
    }

    private func applyFormat(_ cmd: FormatCommand, to tv: NSTextView) {
        let range = tv.selectedRange()
        guard let storage = tv.textStorage else { return }

        switch cmd {
        case .bold:
            toggleTrait(.boldFontMask, in: storage, range: range, tv: tv)
        case .italic:
            toggleTrait(.italicFontMask, in: storage, range: range, tv: tv)
        case .underline:
            toggleAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, in: storage, range: range)
        case .strikethrough:
            toggleAttribute(.strikethroughStyle, value: NSUnderlineStyle.single.rawValue, in: storage, range: range)
        case .h1:
            setBlockFont(NSFont.systemFont(ofSize: 28, weight: .bold), color: NSColor(Color.inkZinc100), in: storage, range: range, tv: tv)
        case .h2:
            setBlockFont(NSFont.systemFont(ofSize: 22, weight: .semibold), color: NSColor(Color.inkZinc100), in: storage, range: range, tv: tv)
        case .h3:
            setBlockFont(NSFont.systemFont(ofSize: 18, weight: .semibold), color: NSColor(Color.inkZinc200), in: storage, range: range, tv: tv)
        case .paragraph:
            setBlockFont(NSFont.systemFont(ofSize: 15, weight: .light), color: NSColor(Color.inkZinc300), in: storage, range: range, tv: tv)
        case .code:
            let codeAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .regular),
                .foregroundColor: NSColor(Color.inkZinc200),
                .backgroundColor: NSColor(Color.inkZinc900),
            ]
            if range.length > 0 {
                storage.addAttributes(codeAttrs, range: range)
            } else {
                tv.typingAttributes = codeAttrs
            }
        case .quote:
            let para = NSMutableParagraphStyle()
            para.headIndent = 16
            para.firstLineHeadIndent = 16
            para.lineSpacing = 4
            let quoteAttrs: [NSAttributedString.Key: Any] = [
                .foregroundColor: NSColor(Color.inkZinc500),
                .paragraphStyle: para,
                .obliqueness: 0.15,
            ]
            if range.length > 0 {
                storage.addAttributes(quoteAttrs, range: range)
            } else {
                tv.typingAttributes = quoteAttrs
            }
        case .bulletList:
            insertListItem("• ", in: tv)
        case .numberedList:
            insertNumberedItem(in: tv, storage: storage)
        case .link(let url):
            if range.length > 0 {
                storage.addAttribute(.link, value: url, range: range)
                storage.addAttribute(.foregroundColor, value: NSColor.systemBlue, range: range)
            }
        }
        tv.delegate?.textDidChange?(Notification(name: NSText.didChangeNotification, object: tv))
    }

    private func toggleTrait(_ trait: NSFontTraitMask, in storage: NSTextStorage, range: NSRange, tv: NSTextView) {
        let fm = NSFontManager.shared
        if range.length > 0 {
            var hasTrait = true
            storage.enumerateAttribute(.font, in: range) { val, _, _ in
                if let f = val as? NSFont, !fm.fontNamed(f.fontName, hasTraits: trait) { hasTrait = false }
            }
            storage.enumerateAttribute(.font, in: range) { val, r, _ in
                let base = (val as? NSFont) ?? NSFont.systemFont(ofSize: 15)
                let newFont = hasTrait ? fm.convert(base, toNotHaveTrait: trait) : fm.convert(base, toHaveTrait: trait)
                storage.addAttribute(.font, value: newFont, range: r)
            }
        } else {
            let currentFont = tv.typingAttributes[.font] as? NSFont ?? NSFont.systemFont(ofSize: 15)
            let hasTrait = fm.fontNamed(currentFont.fontName, hasTraits: trait)
            let newFont = hasTrait ? fm.convert(currentFont, toNotHaveTrait: trait) : fm.convert(currentFont, toHaveTrait: trait)
            tv.typingAttributes[.font] = newFont
        }
    }

    private func toggleAttribute(_ key: NSAttributedString.Key, value: Int, in storage: NSTextStorage, range: NSRange) {
        guard range.length > 0 else { return }
        var hasAttr = false
        storage.enumerateAttribute(key, in: range) { val, _, _ in if val != nil { hasAttr = true } }
        if hasAttr {
            storage.removeAttribute(key, range: range)
        } else {
            storage.addAttribute(key, value: value, range: range)
        }
    }

    private func setBlockFont(_ font: NSFont, color: NSColor, in storage: NSTextStorage, range: NSRange, tv: NSTextView) {
        let para = NSMutableParagraphStyle()
        para.lineSpacing = 4
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: para]
        let r = range.length > 0 ? lineRange(for: range, in: storage) : range
        if r.length > 0 {
            storage.addAttributes(attrs, range: r)
        } else {
            tv.typingAttributes = attrs
        }
    }

    private func lineRange(for range: NSRange, in storage: NSTextStorage) -> NSRange {
        (storage.string as NSString).lineRange(for: range)
    }

    private func insertListItem(_ bullet: String, in tv: NSTextView) {
        let loc = tv.selectedRange().location
        let line = (tv.string as NSString).lineRange(for: NSRange(location: loc, length: 0))
        let lineStr = (tv.string as NSString).substring(with: line)
        if !lineStr.hasPrefix(bullet) {
            let as_ = NSAttributedString(string: bullet, attributes: tv.typingAttributes)
            tv.textStorage?.insert(as_, at: line.location)
            tv.setSelectedRange(NSRange(location: line.location + bullet.count + (loc - line.location), length: 0))
        }
    }

    private func insertNumberedItem(in tv: NSTextView, storage: NSTextStorage) {
        let loc = tv.selectedRange().location
        let as_ = NSAttributedString(string: "1. ", attributes: tv.typingAttributes)
        storage.insert(as_, at: loc)
        tv.setSelectedRange(NSRange(location: loc + as_.length, length: 0))
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: RichTextEditor
        weak var textView: NSTextView?
        var lastCommand: FormatCommand?
        var lastInsert: String?
        var lastVersion: Int = 0
        private var isHandlingListContinuation = false

        init(_ parent: RichTextEditor) { self.parent = parent }

        func textDidChange(_ notification: Notification) {
            guard let tv = notification.object as? NSTextView else { return }
            parent.plainText = tv.string
            let words = tv.string.split(whereSeparator: \.isWhitespace).count
            parent.onWordCount(words, tv.string.count)

            // Auto-style first line as H1, rest as paragraph
            if let storage = tv.textStorage {
                let nsString = storage.string as NSString
                let firstLineRange = nsString.lineRange(for: NSRange(location: 0, length: 0))

                // H1 style
                let h1Font = NSFont.systemFont(ofSize: 26, weight: .semibold)
                let h1Attrs: [NSAttributedString.Key: Any] = [
                    .font: h1Font,
                    .foregroundColor: NSColor(Color.inkZinc100),
                ]

                storage.beginEditing()
                // Promote first line to H1 without touching the rest
                if firstLineRange.length > 0 {
                    storage.addAttributes(h1Attrs, range: firstLineRange)
                }
                storage.endEditing()
            }

            // Automatic list continuation for bullets and numbered lists
            guard !isHandlingListContinuation else { return }
            guard tv.selectedRange.length == 0 else { return }

            let cursorLocation = tv.selectedRange.location
            guard cursorLocation > 0 else { return }

            let nsString = tv.string as NSString
            let previousCharRange = NSRange(location: cursorLocation - 1, length: 1)
            let previousChar = nsString.substring(with: previousCharRange)

            // Only react immediately after a newline
            guard previousChar == "\n" else { return }

            isHandlingListContinuation = true
            defer { isHandlingListContinuation = false }

            // Look at the previous line to decide what to do
            let prevLineRange = nsString.lineRange(for: NSRange(location: max(cursorLocation - 2, 0), length: 0))
            let prevLine = nsString.substring(with: prevLineRange)
            let trimmed = prevLine.trimmingCharacters(in: .whitespacesAndNewlines)

            // Bullet continuation: "• "
            if trimmed.hasPrefix("•") {
                // If the line is just "•" or "• " (no content), pressing Enter should end the list
                let content = trimmed.dropFirst(1).trimmingCharacters(in: .whitespaces)
                if content.isEmpty {
                    // Remove the previous bullet marker
                    if let storage = tv.textStorage {
                        storage.beginEditing()
                        storage.replaceCharacters(in: prevLineRange, with: "")
                        storage.endEditing()
                        tv.setSelectedRange(NSRange(location: max(prevLineRange.location, 0), length: 0))
                    }
                } else {
                    tv.insertText("• ", replacementRange: tv.selectedRange())
                }
                return
            }

            // Numbered list continuation: "1. ", "2. ", ...
            var numberPrefix = ""
            for ch in trimmed {
                if ch.isNumber {
                    numberPrefix.append(ch)
                } else {
                    break
                }
            }

            if !numberPrefix.isEmpty {
                let remainder = trimmed.dropFirst(numberPrefix.count).trimmingCharacters(in: .whitespaces)
                if remainder.hasPrefix(".") {
                    let afterDot = remainder.dropFirst().trimmingCharacters(in: .whitespaces)
                    if afterDot.isEmpty {
                        // Line like "1." or "1. " with no content: end the list when pressing Enter
                        if let storage = tv.textStorage {
                            storage.beginEditing()
                            storage.replaceCharacters(in: prevLineRange, with: "")
                            storage.endEditing()
                            tv.setSelectedRange(NSRange(location: max(prevLineRange.location, 0), length: 0))
                        }
                    } else {
                        // Continue the numbered list: increment the number
                        if let current = Int(numberPrefix) {
                            let next = current + 1
                            tv.insertText("\(next). ", replacementRange: tv.selectedRange())
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Format Command

enum FormatCommand: Equatable {
    case bold, italic, underline, strikethrough
    case h1, h2, h3, paragraph
    case code, quote, bulletList, numberedList
    case link(String)

    static func == (lhs: FormatCommand, rhs: FormatCommand) -> Bool {
        switch (lhs, rhs) {
        case (.bold, .bold), (.italic, .italic), (.underline, .underline),
             (.strikethrough, .strikethrough), (.h1, .h1), (.h2, .h2),
             (.h3, .h3), (.paragraph, .paragraph), (.code, .code),
             (.quote, .quote), (.bulletList, .bulletList), (.numberedList, .numberedList):
            return true
        case (.link(let a), .link(let b)): return a == b
        default: return false
        }
    }
}

// MARK: - NSWindow resize observer (macOS-native width tracking)
// Wraps an invisible NSView that subscribes to its window's resize notifications.
// This is the correct pattern on macOS — no GeometryReader polling loops.

private struct WindowWidthReader: NSViewRepresentable {
    var onResize: (CGFloat) -> Void

    func makeNSView(context: Context) -> NSView {
        let v = ResizeObserverView()
        v.onResize = onResize
        return v
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        (nsView as? ResizeObserverView)?.onResize = onResize
    }

    // Private NSView subclass — hooks into windowDidResize the moment it joins a window
    private class ResizeObserverView: NSView {
        var onResize: ((CGFloat) -> Void)?
        private var token: NSObjectProtocol?

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            token.map { NotificationCenter.default.removeObserver($0) }
            token = nil
            guard let win = window else { return }
            // Fire once immediately with the current width
            onResize?(win.frame.width)
            // Then fire on every resize
            token = NotificationCenter.default.addObserver(
                forName: NSWindow.didResizeNotification,
                object: win,
                queue: .main
            ) { [weak self, weak win] _ in
                guard let w = win?.frame.width else { return }
                self?.onResize?(w)
            }
        }

        deinit {
            token.map { NotificationCenter.default.removeObserver($0) }
        }
    }
}

// MARK: - Content View

struct ContentView: View {
    @EnvironmentObject var store: AppStore
    @State private var currentNotebookId: String?
    @State private var currentNoteId: String?
    @State private var selectedTag: String?
    @State private var showStarred = false
    @State private var showTrash  = false

    // ── Panel state ──────────────────────────────────────────────────────────
    // windowWidth is written by WindowWidthReader (NSWindow notifications).
    // middlePanelUserOpen is the explicit user toggle from the toolbar button.
    @State private var windowWidth: CGFloat = 1200
    @State private var sidebarUserOpen: Bool = true
    @State private var middlePanelUserOpen: Bool = true

    // ── Breakpoints (matching the web app) ───────────────────────────────────
    // sidebarBreakpoint: when the LEFT sidebar appears / disappears
    // middleBreakpoint : when the MIDDLE list panel appears / disappears
    // xlBreakpoint     : when the middle panel widens from 260 → 320
    private let sidebarBreakpoint: CGFloat = 900
    private let middleBreakpoint: CGFloat  = 760
    private let xlBreakpoint: CGFloat      = 1100

    // ── Derived panel state ──────────────────────────────────────────────────
    // Key rule: panels are ALWAYS in the view hierarchy.
    // We drive their width to 0 when collapsed and clip overflow.
    // This lets SwiftUI animate the width transition smoothly — no if/else swaps.

    private var sidebarOpen: Bool {
        // Sidebar only visible on wider layouts and when user hasn't collapsed it.
        windowWidth >= sidebarBreakpoint && sidebarUserOpen
    }

    private var middleOpen: Bool {
        // Middle panel survives longer than sidebar:
        // first it replaces the sidebar, then it collapses,
        // leaving only the main editor.
        windowWidth >= middleBreakpoint && middlePanelUserOpen
    }

    private var middleTargetWidth: CGFloat {
        // Matches web: w-[320px] at xl, w-[260px] at lg
        windowWidth >= xlBreakpoint ? 320 : 260
    }

    // Smooth spring — feel matches CSS cubic-bezier(0.32, 0.72, 0, 1) / 700ms
    private let collapseAnim = Animation.spring(response: 0.45, dampingFraction: 0.78, blendDuration: 0)

    // ── Computed note data ───────────────────────────────────────────────────
    private var nbId: String? {
        currentNotebookId ?? store.notebooks.first?.id
    }

    private func noteList() -> [Note] {
        store.notesFor(
            notebookId: showTrash ? nil : nbId,
            tag: selectedTag,
            starred: showStarred,
            trash: showTrash
        )
    }

    private func activeNote(from list: [Note]) -> Note? {
        if let id = currentNoteId, let n = store.notes.first(where: { $0.id == id }) { return n }
        return list.first.flatMap { n in store.notes.first { $0.id == n.id } }
    }

    private func notebookLabel() -> String {
        if showTrash   { return "Trash" }
        if showStarred { return "Starred" }
        if let t = selectedTag { return "#\(t)" }
        return store.notebooks.first(where: { $0.id == nbId })?.name ?? ""
    }

    // ────────────────────────────────────────────────────────────────────────

    var body: some View {
        let list = noteList()
        let note = activeNote(from: list)

        HStack(spacing: 0) {

            // ── Left Sidebar ─────────────────────────────────────────────────
            // Always in the hierarchy. Width collapses to 0 below lg, clipped.
            LeftSidebarView(
                currentNotebookId: currentNotebookId ?? store.notebooks.first?.id,
                showStarred: $showStarred,
                showTrash: $showTrash,
                selectedTag: $selectedTag,
                onSelect: { id in
                    currentNotebookId = id
                    currentNoteId     = nil
                    showStarred       = false
                    showTrash         = false
                    selectedTag       = nil
                },
                onCreate: { name in
                    store.addNotebook(name: name)
                    currentNotebookId = store.notebooks.last?.id
                },
                onDelete: { id in
                    store.deleteNotebook(id: id)
                    if currentNotebookId == id {
                        currentNotebookId = store.notebooks.first?.id
                    }
                    currentNoteId = nil
                },
                onToggleSidebar: {
                    // Only allow manual toggle when window is wide enough for sidebar
                    guard windowWidth >= sidebarBreakpoint else { return }
                    withAnimation(collapseAnim) {
                        sidebarUserOpen.toggle()
                    }
                }
            )
            // Fixed 200 pt when open, 0 pt when collapsed — animates smoothly
            .frame(width: sidebarOpen ? 220 : 0)
            .clipped()           // hide overflow as width shrinks

            // Divider only occupies space when sidebar is open
            Rectangle()
                .fill(Color.inkBorder)
                .frame(width: sidebarOpen ? 0.5 : 0)

            // ── Middle Panel ─────────────────────────────────────────────────
            // Always in hierarchy. Collapses to 0 when: window too narrow OR
            // user pressed the toggle button. Width grows at xl breakpoint.
            MiddlePanelView(
                notes: list,
                currentNoteId: note?.id,
                notebookName: notebookLabel(),
                showTrash: showTrash,
                canCreate: !showTrash && !showStarred && selectedTag == nil && nbId != nil,
                onSelect: { currentNoteId = $0 },
                onCreate: {
                    guard let nb = currentNotebookId ?? store.notebooks.first?.id else { return }
                    let id = store.addNote(notebookId: nb)
                    currentNoteId = id
                },
                onDelete: { id in
                    store.softDelete(id: id)
                    if currentNoteId == id {
                        currentNoteId = list.first(where: { $0.id != id })?.id
                    }
                },
                onRestore: { store.restore(id: $0) },
                onPermanentDelete: { id in
                    store.permanentDelete(id: id)
                    if currentNoteId == id { currentNoteId = nil }
                }
            )
            // Width slides between 0 ↔ target smoothly
            .frame(width: middleOpen ? middleTargetWidth : 0)
            .clipped()

            Rectangle()
                .fill(Color.inkBorder)
                .frame(width: middleOpen ? 0.5 : 0)

            // ── Editor — always visible, takes all remaining space ────────────
            Group {
                if let n = note {
                    EditorView(
                        note: n,
                        middlePanelOpen: middleOpen,
                        onToggle: {
                            // Only allow manual toggle when window is wide enough
                            guard windowWidth >= middleBreakpoint else { return }
                            withAnimation(collapseAnim) {
                                middlePanelUserOpen.toggle()
                            }
                        },
                        onToggleSidebar: {
                            // Allow bringing sidebar back regardless of current state,
                            // but only when window is wide enough for it.
                            guard windowWidth >= sidebarBreakpoint else { return }
                            withAnimation(collapseAnim) {
                                sidebarUserOpen.toggle()
                            }
                        },
                        onSave: { title, content, rtf in
                            store.updateNote(id: n.id, title: title, content: content, rtfData: rtf)
                        },
                        onStar:     { store.updateNote(id: n.id, starred: $0) },
                        onTags:     { store.updateNote(id: n.id, tags: $0) },
                        onReminder: { store.updateNote(id: n.id, reminderAt: $0) }
                    )
                    .id(n.id)
                } else {
                    VStack(spacing: 10) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 38))
                            .foregroundStyle(Color.inkZinc700)
                        Text("Select a note")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.inkZinc500)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.inkBlack)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.inkBlack)
        .preferredColorScheme(.dark)
        // ── WindowWidthReader: invisible NSView that tracks NSWindow resize ──
        // Placed in a zero-size background so it never affects layout.
        .background(
            WindowWidthReader { newWidth in
                // Directly bind window width to NSWindow frame;
                // resizing itself is already a smooth, continuous gesture.
                windowWidth = newWidth
            }
            .frame(width: 0, height: 0)   // takes no space
        )
        .onAppear {
            if currentNotebookId == nil {
                currentNotebookId = store.notebooks.first?.id
            }
        }
    }
}

// MARK: - Left Sidebar

struct LeftSidebarView: View {
    @EnvironmentObject var store: AppStore
    let currentNotebookId: String?
    @Binding var showStarred: Bool
    @Binding var showTrash: Bool
    @Binding var selectedTag: String?
    let onSelect: (String) -> Void
    let onCreate: (String) -> Void
    let onDelete: (String) -> Void
    let onToggleSidebar: () -> Void

    @State private var activeTab = 0
    @State private var search = ""
    @State private var showNewNB = false
    @State private var newNBName = ""
    @State private var deleteTarget: Notebook?

    private var filteredNotebooks: [Notebook] {
        search.isEmpty ? store.notebooks : store.notebooks.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    private var filteredTags: [String] {
        search.isEmpty ? store.allTags : store.allTags.filter { $0.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Logo + collapse button
            HStack(spacing: 8) {
                HStack(spacing: 0) {
                    Text("Inked")
                        .font(.system(size: 15, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.inkZinc100)
                    Text("+")
                        .font(.system(size: 15, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.inkRed900)
                }
                Spacer()
                Button(action: onToggleSidebar) {
                    Image(systemName: "sidebar.leading")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.inkZinc500)
                        .frame(width: 22, height: 22)
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 54)
            sidebarDivider()

            // Quick filters, grouped
            HStack(spacing: 8) {
                filterButton("★ Starred", isActive: showStarred, activeColor: .inkAmber, activeBg: Color.inkAmber.opacity(0.15)) {
                    showStarred.toggle(); showTrash = false; if showStarred { selectedTag = nil }
                }
                filterButton("Trash", icon: "trash", isActive: showTrash, activeColor: .inkZinc100, activeBg: Color.inkZinc700) {
                    showTrash.toggle(); showStarred = false; if showTrash { selectedTag = nil }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.inkZinc900.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            sidebarDivider()

            // Tabs
            HStack(spacing: 0) {
                sidebarTab("Notebooks", index: 0)
                sidebarTab("Tags", index: 1)
            }
            sidebarDivider()

            // Search
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.inkZinc500)
                TextField(activeTab == 0 ? "Search notebooks..." : "Search tags...", text: $search)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.inkZinc300)
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(Color.inkZinc900.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.inkZinc800, lineWidth: 0.5))
            .padding(.horizontal, 8).padding(.vertical, 8)

            // Section label
            Text(activeTab == 0 ? "MY NOTEBOOKS" : "TAGS")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Color.inkZinc600)
                .tracking(1.5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.bottom, 2)

            // List
            ScrollView {
                VStack(spacing: 1) {
                    if activeTab == 0 {
                        ForEach(filteredNotebooks) { nb in
                            notebookRow(nb)
                        }
                    } else {
                        if filteredTags.isEmpty {
                            Text(store.allTags.isEmpty ? "No tags yet" : "No matches")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.inkZinc500)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 20)
                        } else {
                            ForEach(filteredTags, id: \.self) { tag in
                                tagRow(tag)
                            }
                        }
                    }
                }
                .padding(.horizontal, 8)
            }
            .background(Color.inkBlack)

            Spacer(minLength: 0)

            // Add notebook button
            if activeTab == 0 {
                sidebarDivider()
                Button { showNewNB = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 11))
                        Text("New Notebook")
                            .font(.system(size: 11))
                    }
                    .foregroundStyle(Color.inkZinc500)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.inkZinc900.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.inkZinc800, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 8).padding(.vertical, 8)
            }
        }
        .background(Color.inkBlack)
        .sheet(isPresented: $showNewNB) { newNotebookSheet }
        .alert("Delete Notebook", isPresented: .init(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } })) {
            Button("Cancel", role: .cancel) { deleteTarget = nil }
            Button("Delete", role: .destructive) { if let nb = deleteTarget { onDelete(nb.id) }; deleteTarget = nil }
        } message: {
            if let nb = deleteTarget { Text("Delete \"\(nb.name)\"? All notes will be removed.") }
        }
    }

    @ViewBuilder
    private func notebookRow(_ nb: Notebook) -> some View {
        let isActive = currentNotebookId == nb.id && !showStarred && !showTrash && selectedTag == nil
        HStack(spacing: 7) {
            Image(systemName: "folder")
                .font(.system(size: 11))
                .foregroundStyle(isActive ? Color.inkZinc200 : Color.inkZinc600)
            Text(nb.name)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(isActive ? Color.inkZinc100 : Color.inkZinc400)
                .lineLimit(1)
            Spacer()
            Button { deleteTarget = nb } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Color.inkZinc600)
                    .opacity(0)
            }
            .buttonStyle(.plain)
            .opacity(isActive ? 1 : 0)
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(isActive ? Color.inkZinc800 : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .contentShape(Rectangle())
        .onTapGesture { onSelect(nb.id) }
    }

    @ViewBuilder
    private func tagRow(_ tag: String) -> some View {
        let isActive = selectedTag == tag
        Text("#\(tag)")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(isActive ? Color.inkZinc100 : Color.inkZinc400)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(isActive ? Color.inkZinc800 : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .contentShape(Rectangle())
            .onTapGesture { selectedTag = (selectedTag == tag) ? nil : tag }
    }

    @ViewBuilder
    private func filterButton(_ label: String, icon: String? = nil, isActive: Bool, activeColor: Color, activeBg: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon { Image(systemName: icon).font(.system(size: 10)) }
                Text(label).font(.system(size: 10, weight: .medium))
            }
            .foregroundStyle(isActive ? activeColor : Color.inkZinc500)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(isActive ? activeBg : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func sidebarTab(_ label: String, index: Int) -> some View {
        Button { activeTab = index } label: {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(activeTab == index ? Color.inkZinc200 : Color.inkZinc500)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .overlay(alignment: .bottom) {
                    if activeTab == index {
                        Rectangle().frame(height: 1.5).foregroundStyle(Color.inkZinc200)
                    }
                }
        }
        .buttonStyle(.plain)
    }

    private func sidebarDivider() -> some View {
        Divider().background(Color.inkZinc800).opacity(0.5)
    }

    private var newNotebookSheet: some View {
        ZStack {
            Color.inkBlack
            VStack(spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("New notebook")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.inkZinc100)
                        Text("Create a fresh space for a set of notes.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                    }
                    Spacer()
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("NAME")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.inkZinc600)
                        .tracking(1.2)

                    HStack(spacing: 8) {
                        Image(systemName: "folder")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                        TextField("Notebook name", text: $newNBName)
                            .textFieldStyle(.plain)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.inkZinc100)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color.inkZinc900)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.inkZinc800, lineWidth: 1)
                    )
                }

                Spacer(minLength: 0)

                HStack {
                    Button("Cancel") {
                        newNBName = ""
                        showNewNB = false
                    }
                    .keyboardShortcut(.cancelAction)
                    .foregroundStyle(Color.inkZinc300)

                    Spacer()

                    Button("Create") {
                        let name = newNBName.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !name.isEmpty {
                            onCreate(name)
                        }
                        newNBName = ""
                        showNewNB = false
                    }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .disabled(newNBName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .font(.system(size: 12, weight: .medium))
            }
            .padding(20)
        }
        .frame(width: 380, height: 210)
    }
}

// MARK: - Middle Panel

struct MiddlePanelView: View {
    @EnvironmentObject var store: AppStore
    let notes: [Note]
    let currentNoteId: String?
    let notebookName: String
    let showTrash: Bool
    let canCreate: Bool
    let onSelect: (String) -> Void
    let onCreate: () -> Void
    let onDelete: (String) -> Void
    let onRestore: (String) -> Void
    let onPermanentDelete: (String) -> Void

    @State private var search = ""
    @State private var deleteTarget: Note?
    @State private var isPermanent = false
    @State private var showDeleteSheet = false

    private var filtered: [Note] {
        guard !search.isEmpty else { return notes }
        return notes.filter {
            $0.title.localizedCaseInsensitiveContains(search) ||
            $0.content.localizedCaseInsensitiveContains(search)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header: search + add
            HStack(spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.inkZinc500)
                    TextField("Search notes...", text: $search)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.inkZinc300)
                }
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(Color.inkZinc900.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(Color.inkZinc800, lineWidth: 0.5))

                Button(action: onCreate) {
                    Image(systemName: "plus")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.inkZinc400)
                        .frame(width: 30, height: 30)
                        .background(Color.inkZinc900.opacity(0.5))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canCreate)
                .opacity(canCreate ? 1 : 0.3)
            }
            .padding(.horizontal, 8).padding(.vertical, 8)
            .frame(minHeight: 52)
            Divider().background(Color.inkZinc800).opacity(0.5)

            // Notebook name bar
            HStack {
                Text(notebookName)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Color.inkZinc600)
                    .tracking(1.2)
                    .lineLimit(1)
                Spacer()
                Text("\(filtered.count) notes")
                    .font(.system(size: 9))
                    .foregroundStyle(Color.inkZinc600)
                    .tracking(0.5)
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            Divider().background(Color.inkZinc800).opacity(0.5)

            // Note list / empty states
            if filtered.isEmpty {
                VStack(spacing: 10) {
                    if !search.isEmpty {
                        Text("No results")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.inkZinc500)
                    } else if showTrash {
                        VStack(spacing: 8) {
                            Image(systemName: "trash")
                                .font(.system(size: 22))
                                .foregroundStyle(Color.inkZinc700)
                            Text("Trash is empty")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.inkZinc500)
                        }
                    } else {
                        VStack(spacing: 10) {
                            Image(systemName: "square.and.pencil")
                                .font(.system(size: 38))
                                .foregroundStyle(Color.inkZinc700)
                            Text("No notes yet")
                                .font(.system(size: 15))
                                .foregroundStyle(Color.inkZinc500)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.inkBlack)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filtered) { note in
                            NoteRow(
                                note: note,
                                isSelected: currentNoteId == note.id,
                                showTrash: showTrash,
                                onSelect: { onSelect(note.id) },
                                onDelete: {
                                    deleteTarget = note
                                    isPermanent = showTrash
                                    showDeleteSheet = true
                                },
                                onRestore: { onRestore(note.id) }
                            )
                            Divider().background(Color.inkZinc800).opacity(0.3).padding(.leading, 14)
                        }
                    }
                }
                .background(Color.inkBlack)
            }
        }
        .background(Color.inkBlack)
        .sheet(isPresented: $showDeleteSheet) { deleteSheet }
    }
}

private extension MiddlePanelView {
    var deleteSheet: some View {
        ZStack {
            Color.inkBlack
            VStack(spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(isPermanent ? "Delete permanently" : "Move to Trash")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.inkZinc100)
                        if let n = deleteTarget {
                            Text(isPermanent
                                 ? "This will permanently delete \"\(n.title.isEmpty ? "Untitled" : n.title)\"."
                                 : "This will move \"\(n.title.isEmpty ? "Untitled" : n.title)\" to Trash.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                        }
                    }
                    Spacer()
                }

                // Icon + warning
                HStack(spacing: 10) {
                    Image(systemName: isPermanent ? "trash.slash" : "trash")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Color.inkRed900)
                        .frame(width: 32, height: 32)
                        .background(Color.inkRed900.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 10))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(isPermanent ? "This cannot be undone." : "You can restore this later from Trash.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                    }
                    Spacer()
                }

                Spacer(minLength: 0)

                // Actions
                HStack {
                    Button("Cancel") {
                        deleteTarget = nil
                        showDeleteSheet = false
                    }
                    .keyboardShortcut(.cancelAction)
                    .foregroundStyle(Color.inkZinc300)

                    Spacer()

                    Button(isPermanent ? "Delete forever" : "Move to Trash") {
                        if let n = deleteTarget {
                            if isPermanent {
                                onPermanentDelete(n.id)
                            } else {
                                onDelete(n.id)
                            }
                        }
                        deleteTarget = nil
                        showDeleteSheet = false
                    }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                }
                .font(.system(size: 12, weight: .medium))
            }
            .padding(20)
        }
        .frame(width: 380, height: 220)
    }
}

struct NoteRow: View {
    let note: Note
    let isSelected: Bool
    let showTrash: Bool
    let onSelect: () -> Void
    let onDelete: () -> Void
    let onRestore: () -> Void

    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 0) {
            // Red left border when selected
            Rectangle()
                .fill(isSelected ? Color.inkRed900 : Color.clear)
                .frame(width: 2)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(note.title.isEmpty ? "Untitled" : note.title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(isSelected ? Color.inkZinc100 : Color.inkZinc200)
                        .lineLimit(1)
                    Spacer()
                    if note.starred && !showTrash {
                        Text("★").font(.system(size: 10)).foregroundStyle(Color.inkAmber)
                    }
                    if showTrash {
                        Button(action: onRestore) {
                            Image(systemName: "arrow.uturn.backward")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.inkZinc400)
                        }.buttonStyle(.plain)
                    }
                    Button(action: onDelete) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.inkRed900.opacity(0.9))
                    }
                    .buttonStyle(.plain)
                    .opacity(isHovering ? 1 : 0)
                }

                Text(note.content.isEmpty ? "No content" : note.content)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.inkZinc500)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(relativeDate(note.updatedAt))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Color.inkZinc600)
                    if !note.tags.isEmpty {
                        ForEach(note.tags.prefix(2), id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.system(size: 9))
                                .foregroundStyle(Color.inkZinc500)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(Color.inkZinc900)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
        }
        .background(isSelected ? Color.inkZinc900 : Color.inkBlack)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .onHover { inside in
            withAnimation(.easeInOut(duration: 0.12)) {
                isHovering = inside
            }
        }
    }

    private func relativeDate(_ d: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: d, to: Date()).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "Yesterday" }
        if days < 7  { return "\(days)d ago" }
        if days < 30 { return "\(days/7)w ago" }
        if days < 365 { return "\(days/30)mo ago" }
        return "\(days/365)y ago"
    }
}

// MARK: - Title / body splitter
// Treats the first line of the plain text as the title (H1),
// everything after the first newline as the body.

private func splitTitleAndBody(from text: String) -> (String, String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let newlineRange = trimmed.range(of: "\n") else {
        // Single-line note: title only
        return (trimmed, "")
    }
    let title = String(trimmed[..<newlineRange.lowerBound]).trimmingCharacters(in: .whitespaces)
    let bodyStart = trimmed.index(after: newlineRange.lowerBound)
    let body = String(trimmed[bodyStart...]).trimmingCharacters(in: .whitespacesAndNewlines)
    return (title, body)
}

// MARK: - Editor View

struct EditorView: View {
    let note: Note
    let middlePanelOpen: Bool
    let onToggle: () -> Void
    let onToggleSidebar: () -> Void
    let onSave: (String, String, Data?) -> Void
    let onStar: (Bool) -> Void
    let onTags: ([String]) -> Void
    let onReminder: (Date?) -> Void

    @State private var bodyText: String
    @State private var rtfData: Data?
    @State private var wordCount = 0
    @State private var charCount = 0
    @State private var isSaving = false
    @State private var showSaved = false
    @State private var saveTask: Task<Void, Never>?
    @State private var formatCmd: FormatCommand?
    @State private var formatTick = 0
    @State private var insertVoice: String?
    @State private var voiceTick = 0
    @State private var showTagSheet = false
    @State private var tagDraft = ""
    @State private var showReminderSheet = false
    @State private var reminderDraft = Date()
    @State private var showLinkSheet = false
    @State private var linkDraft = ""
    @State private var showMore = false
    @StateObject private var voice = VoiceRecognizer()
    @State private var selectedFontName: String = "Poppins"
    @State private var showSettingsSheet = false
    @State private var micAutoEnabled: Bool = UserDefaults.standard.bool(forKey: "inkedAutoMic")

    init(note: Note,
         middlePanelOpen: Bool,
         onToggle: @escaping () -> Void,
         onToggleSidebar: @escaping () -> Void,
         onSave: @escaping (String, String, Data?) -> Void,
         onStar: @escaping (Bool) -> Void,
         onTags: @escaping ([String]) -> Void,
         onReminder: @escaping (Date?) -> Void) {
        self.note = note
        self.middlePanelOpen = middlePanelOpen
        self.onToggle = onToggle
        self.onToggleSidebar = onToggleSidebar
        self.onSave = onSave
        self.onStar = onStar
        self.onTags = onTags
        self.onReminder = onReminder
        let combined = [note.title, note.content].joined(separator: note.content.isEmpty ? "" : "\n")
        _bodyText = State(initialValue: combined)
        _rtfData = State(initialValue: note.rtfData)
        _tagDraft = State(initialValue: note.tags.joined(separator: ", "))
        _reminderDraft = State(initialValue: note.reminderAt ?? Date().addingTimeInterval(3600))
    }

    var body: some View {
        VStack(spacing: 0) {
            topToolbar
            Divider().background(Color.inkZinc800).opacity(0.5)
            editorBody
        }
        .background(Color.inkBlack)
        .onAppear {
            let combined = [note.title, note.content].joined(separator: note.content.isEmpty ? "" : "\n")
            bodyText = combined
            rtfData = note.rtfData
            tagDraft = note.tags.joined(separator: ", ")
            reminderDraft = note.reminderAt ?? Date().addingTimeInterval(3600)
            voice.onFinalResult = { text in
                insertVoice = text + String(voiceTick)
                voiceTick += 1
            }
        }
        .onChange(of: note.id) { _ in
            voice.stop()
            let combined = [note.title, note.content].joined(separator: note.content.isEmpty ? "" : "\n")
            bodyText = combined
            rtfData = note.rtfData
            tagDraft = note.tags.joined(separator: ", ")
        }
        .sheet(isPresented: $showTagSheet) { tagSheet }
        .sheet(isPresented: $showReminderSheet) { reminderSheet }
        .sheet(isPresented: $showLinkSheet) { linkSheet }
        .sheet(isPresented: $showSettingsSheet) { settingsSheet }
    }

    // MARK: Top Toolbar

    private var topToolbar: some View {
        HStack(spacing: 8) {
            // Left group 1: sidebar toggle, middle panel toggle, star
            toolbarPill {
                toolBtn(systemImage: "sidebar.leading") { onToggleSidebar() }
                toolBtn(systemImage: middlePanelOpen ? "sidebar.left" : "sidebar.right") { onToggle() }
                toolBtn(systemImage: note.starred ? "star.fill" : "star",
                        color: note.starred ? .inkAmber : .inkZinc400) { onStar(!note.starred) }
            }

            // Left group 2: font, tag, type
            toolbarPill {
                // Font selector
                Menu {
                    ForEach(["Poppins", "SF Pro", "Menlo", "Georgia", "Helvetica Neue"], id: \.self) { name in
                        Button {
                            selectedFontName = name
                        } label: {
                            HStack {
                                Text(name)
                                if selectedFontName == name {
                                    Spacer()
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(selectedFontName)
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(Color.inkZinc300)
                    .padding(.horizontal, 8)
                }
                .menuStyle(.borderlessButton)
                .fixedSize()

                toolBtn(systemImage: "number", color: Color.inkRed900) { showTagSheet = true }
                toolBtn(systemImage: "textformat") { fire(.paragraph) }
            }

            // Left group 3: attach, mic, AI, video
            toolbarPill {
                toolBtn(systemImage: "paperclip") {}
                toolBtn(systemImage: voice.isRecording ? "mic.fill" : "mic",
                        color: voice.isRecording ? .red : .inkZinc400) { voice.toggle() }
                toolBtn(systemImage: "sparkles") {}
                toolBtn(systemImage: "video") {}
            }

            Spacer()

            // Record pill button (fixed, consistent height)
            Button {
                voice.toggle()
            } label: {
                HStack(spacing: 8) {
                    Circle()
                        .fill(.white)
                        .frame(width: 7, height: 7)
                        .opacity(voice.isRecording ? 1 : 1)
                        .scaleEffect(voice.isRecording ? 1.0 : 0.85)
                        .animation(
                            voice.isRecording
                            ? .easeInOut(duration: 0.7).repeatForever(autoreverses: true)
                            : .default,
                            value: voice.isRecording
                        )
                    Text("Record")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .padding(.horizontal, 14)
                .frame(height: 28)
                .background(voice.isRecording ? Color.inkRed800 : Color.inkRed900)
                .clipShape(Capsule())
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)

            // Right group: bell, share, more, settings
            toolbarPill {
                toolBtn(systemImage: note.reminderAt != nil ? "bell.fill" : "bell",
                        color: note.reminderAt != nil ? .inkAmber : .inkZinc400) { showReminderSheet = true }
                toolBtn(systemImage: "square.and.arrow.up") {
                    let (title, body) = splitTitleAndBody(from: bodyText)
                    let text = title.isEmpty ? body : "\(title)\n\n\(body)"
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(text, forType: .string)
                }
                Menu {
                    Button("Copy note") {
                        NSPasteboard.general.clearContents()
                        let (title, body) = splitTitleAndBody(from: bodyText)
                        let text = title.isEmpty ? body : "\(title)\n\n\(body)"
                        NSPasteboard.general.setString(text, forType: .string)
                    }
                    Divider()
                    Button("Export as .txt") { exportTxt() }
                    Button("Export as Markdown") { exportMD() }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.inkZinc400)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .menuStyle(.borderlessButton)
                .fixedSize()

                toolBtn(systemImage: "gearshape") {
                    showSettingsSheet = true
                }
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .frame(minHeight: 52)
        .background(Color.inkBlack)
    }

    // MARK: Editor Body

    private var editorBody: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                // Single rich text area – first line acts as H1
                ZStack(alignment: .topTrailing) {
                    RichTextEditor(
                        rtfData: $rtfData,
                        plainText: $bodyText,
                        onWordCount: { w, c in wordCount = w; charCount = c },
                        formatCommand: formatCmd,
                        insertText: insertVoice,
                        fontName: selectedFontName,
                        formatVersion: formatTick
                    )
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                    .onChange(of: bodyText) { _ in scheduleSave() }
                    .onChange(of: rtfData) { _ in scheduleSave() }

                    // Word / char counter
                    HStack(spacing: 8) {
                        HStack(spacing: 3) {
                            Text("\(wordCount)").font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.white)
                            Text("words").font(.system(size: 10)).foregroundStyle(Color.inkZinc500)
                        }
                        Rectangle().fill(Color.inkZinc700).frame(width: 1, height: 10)
                        HStack(spacing: 3) {
                            Text("\(charCount)").font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.white)
                            Text("characters").font(.system(size: 10)).foregroundStyle(Color.inkZinc500)
                        }
                    }
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.inkZinc900.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.inkZinc800.opacity(0.3), lineWidth: 0.5))
                    .padding(.top, 4)
                    .padding(.trailing, 32)
                }
            }

            // Bottom floating format bar
            bottomFormatBar
                .padding(.bottom, 20)
        }
    }

    // MARK: Bottom Format Bar

    private var bottomFormatBar: some View {
        HStack(spacing: 6) {
            // Block type
            formatGroup {
                fmtBtn("H1")   { fire(.h1) }
                fmtBtn("H2")   { fire(.h2) }
                fmtBtn("H3")   { fire(.h3) }
                fmtBtn(systemImage: "textformat") { fire(.paragraph) }
            }
            // Inline
            formatGroup {
                fmtBtn("B", bold: true)    { fire(.bold) }
                fmtBtn("I", italic: true)  { fire(.italic) }
                fmtBtn("U", underline: true) { fire(.underline) }
                fmtBtn("S", strikethrough: true) { fire(.strikethrough) }
            }
            // Lists / blocks
            formatGroup {
                fmtBtn(systemImage: "list.bullet")       { fire(.bulletList) }
                fmtBtn(systemImage: "list.number")       { fire(.numberedList) }
                fmtBtn(systemImage: "text.quote")        { fire(.quote) }
                fmtBtn(systemImage: "chevron.left.forwardslash.chevron.right") { fire(.code) }
            }
            // Link
            formatGroup {
                fmtBtn(systemImage: "link") { showLinkSheet = true }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.ultraThinMaterial.opacity(0.01))
        .background(Color.inkZinc900.opacity(0.97))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color.inkZinc800.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.5), radius: 20, y: 8)
    }

    // MARK: Sheets

    private var tagSheet: some View {
        ZStack {
            Color.inkBlack
            VStack(spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Edit tags")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.inkZinc100)
                        Text("Separate multiple tags with commas.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                    }
                    Spacer()
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("TAGS")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.inkZinc600)
                        .tracking(1.2)

                    HStack(spacing: 8) {
                        Image(systemName: "number")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkRed900)
                        TextField("work, personal, ideas", text: $tagDraft)
                            .textFieldStyle(.plain)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.inkZinc100)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color.inkZinc900)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.inkZinc800, lineWidth: 1)
                    )
                }

                Spacer(minLength: 0)

                HStack {
                    Button("Cancel") {
                        showTagSheet = false
                    }
                    .keyboardShortcut(.cancelAction)
                    .foregroundStyle(Color.inkZinc300)

                    Spacer()

                    Button("Save") {
                        let tags = tagDraft
                            .split(separator: ",")
                            .map { $0.trimmingCharacters(in: .whitespaces) }
                            .filter { !$0.isEmpty }
                        onTags(tags)
                        showTagSheet = false
                    }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                }
                .font(.system(size: 12, weight: .medium))
            }
            .padding(20)
        }
        .frame(width: 380, height: 210)
    }

    private var reminderSheet: some View {
        ZStack {
            Color.inkBlack
            VStack(spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Set reminder")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.inkZinc100)
                        Text("Pick a time to be nudged about this note.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                    }
                    Spacer()
                }

                // Date & time
                VStack(alignment: .leading, spacing: 8) {
                    Text("REMINDER")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.inkZinc600)
                        .tracking(1.2)

                    DatePicker("Date & Time", selection: $reminderDraft)
                        .labelsHidden()
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(Color.inkZinc900)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.inkZinc800, lineWidth: 1)
                        )

                    if note.reminderAt != nil {
                        Button("Clear existing reminder", role: .destructive) {
                            onReminder(nil)
                            showReminderSheet = false
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Color.inkRed900)
                        .font(.system(size: 11, weight: .medium))
                        .padding(.top, 4)
                    }
                }

                Spacer(minLength: 0)

                // Actions
                HStack {
                    Button("Cancel") {
                        showReminderSheet = false
                    }
                    .keyboardShortcut(.cancelAction)
                    .foregroundStyle(Color.inkZinc300)

                    Spacer()

                    Button("Set reminder") {
                        onReminder(reminderDraft)
                        showReminderSheet = false
                    }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                }
                .font(.system(size: 12, weight: .medium))
            }
            .padding(20)
        }
        .frame(width: 380, height: 220)
    }

    private var linkSheet: some View {
        VStack(spacing: 20) {
            Text("Insert Link").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
            TextField("https://...", text: $linkDraft)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Cancel") { showLinkSheet = false; linkDraft = "" }.buttonStyle(.bordered)
                Spacer()
                Button("Insert") {
                    if !linkDraft.isEmpty { fire(.link(linkDraft)) }
                    showLinkSheet = false
                    linkDraft = ""
                }
                .buttonStyle(.borderedProminent)
                .disabled(linkDraft.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
    }

    // MARK: Helpers

    private func fire(_ cmd: FormatCommand) {
        formatTick += 1
        formatCmd = cmd
    }

    private func scheduleSave() {
        isSaving = true
        showSaved = false
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                let (title, body) = splitTitleAndBody(from: bodyText)
                onSave(title, body, rtfData)
                isSaving = false
                showSaved = true
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 1_800_000_000)
                    showSaved = false
                }
            }
        }
    }

    private func exportTxt() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.plainText]
        let (title, body) = splitTitleAndBody(from: bodyText)
        panel.nameFieldStringValue = (title.isEmpty ? "note" : title) + ".txt"
        if panel.runModal() == .OK, let url = panel.url {
            let text = title.isEmpty ? body : "\(title)\n\n\(body)"
            try? text.write(to: url, atomically: true, encoding: String.Encoding.utf8)
        }
    }

    private func exportMD() {
        let panel = NSSavePanel()
        let (title, body) = splitTitleAndBody(from: bodyText)
        panel.nameFieldStringValue = (title.isEmpty ? "note" : title) + ".md"
        if panel.runModal() == .OK, let url = panel.url {
            let header = title.isEmpty ? "Untitled" : title
            let md = "# \(header)\n\n\(body)"
            try? md.write(to: url, atomically: true, encoding: String.Encoding.utf8)
        }
    }

    private var settingsSheet: some View {
        ZStack {
            Color.inkBlack
            VStack(spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Inked+ settings")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.inkZinc100)
                        Text("Control microphone behavior for voice notes.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.inkZinc500)
                    }
                    Spacer()
                }

                // Mic auto access
                VStack(alignment: .leading, spacing: 10) {
                    Text("MICROPHONE")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.inkZinc600)
                        .tracking(1.2)

                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Allow automatic mic access")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.inkZinc100)
                            Text("If enabled, Inked+ will try to pre‑authorize mic access so you aren’t prompted every time you hit Record.")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.inkZinc500)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                        Toggle("", isOn: $micAutoEnabled)
                            .toggleStyle(.switch)
                            .labelsHidden()
                            .tint(.green)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 10)
                    .background(Color.inkZinc900)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.inkZinc800, lineWidth: 1)
                    )
                }

                Spacer(minLength: 0)

                // Footer
                HStack {
                    Button("Close") {
                        showSettingsSheet = false
                    }
                    .keyboardShortcut(.cancelAction)
                    .foregroundStyle(Color.inkZinc300)

                    Spacer()
                }
                .font(.system(size: 12, weight: .medium))
            }
            .padding(20)
        }
        .frame(width: 420, height: 220)
        .onChange(of: micAutoEnabled) { value in
            UserDefaults.standard.set(value, forKey: "inkedAutoMic")
        }
        .onAppear {
            micAutoEnabled = UserDefaults.standard.bool(forKey: "inkedAutoMic")
        }
    }

    // MARK: Component helpers

    @ViewBuilder
    private func toolbarPill<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 2) { content() }
            .padding(.horizontal, 4).padding(.vertical, 4)
            .background(Color.inkZinc900.opacity(0.5))
            .clipShape(Capsule())
    }

    @ViewBuilder
    private func toolBtn(systemImage: String, color: Color = .inkZinc400, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13))
                .foregroundStyle(color)
                .frame(width: 30, height: 30)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func formatGroup<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 1) { content() }
            .padding(.horizontal, 2).padding(.vertical, 2)
            .background(Color.inkZinc800.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: 7))
    }

    @ViewBuilder
    private func fmtBtn(_ label: String, bold: Bool = false, italic: Bool = false,
                         underline: Bool = false, strikethrough: Bool = false,
                         action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: bold ? .bold : .regular, design: .monospaced))
                .italic(italic)
                .underline(underline)
                .strikethrough(strikethrough)
                .foregroundStyle(Color.inkZinc400)
                .frame(width: 24, height: 24)
        }
        .buttonStyle(.plain)
        .buttonStyle(FmtButtonStyle())
    }

    @ViewBuilder
    private func fmtBtn(systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 11))
                .foregroundStyle(Color.inkZinc400)
                .frame(width: 24, height: 24)
        }
        .buttonStyle(.plain)
        .buttonStyle(FmtButtonStyle())
    }
}

struct FmtButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.inkZinc700.opacity(0.5) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}