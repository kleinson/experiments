import Foundation
import SwiftUI
import UIKit
import ShellCore

@main
struct ShellRemembersApp: App {
    var body: some Scene {
        WindowGroup { ShellRootView() }
    }
}

@MainActor
final class ShellModel: ObservableObject {
    enum StorageState {
        case loading
        case ready(SpecimenCollection?)
        case failed(String)
    }

    @Published private(set) var content: ShellContent?
    @Published private(set) var startupError: String?
    @Published private(set) var specimen: SpecimenState?
    @Published private(set) var storage: StorageState = .loading
    @Published var operationError: String?
    @Published var confirmation: String?
    @Published var note = ""
    private var store: CollectionStore?

    func open() {
        do {
            let loaded = try ShellContent.bundled()
            let state = try SpecimenState(adultLengthMm: loaded.experience.specimen.defaultLengthMm)
            let support = try FileManager.default.url(
                for: .applicationSupportDirectory, in: .userDomainMask,
                appropriateFor: nil, create: true
            )
            store = CollectionStore(
                fileURL: support.appendingPathComponent("TheShellRemembers", isDirectory: true)
                    .appendingPathComponent("collection-v1.json"),
                allowedSpecimenID: loaded.experience.specimen.id
            )
            content = loaded
            specimen = state
            startupError = nil
            reloadCollection()
        } catch {
            startupError = error.localizedDescription
        }
    }

    func reloadCollection() {
        guard let store else { return }
        do {
            storage = .ready(try store.load())
            operationError = nil
        } catch {
            storage = .failed(error.localizedDescription)
        }
    }

    func changeGrowth(_ value: Double) {
        do {
            guard var state = specimen else {
                throw ShellError.invalid("The demo has not loaded.")
            }
            try state.setGrowth(value)
            specimen = state
            confirmation = nil
        } catch {
            operationError = error.localizedDescription
        }
    }

    func changeLength(_ value: Double) {
        do {
            guard value.isFinite, value.rounded() == value else {
                throw ShellError.invalid("Length must be a finite whole number of millimetres.")
            }
            guard var state = specimen else {
                throw ShellError.invalid("The demo has not loaded.")
            }
            guard (50...160).contains(value) else {
                throw ShellError.invalid("Length must be between 50 and 160 mm.")
            }
            try state.setAdultLength(Int(value))
            specimen = state
            confirmation = nil
        } catch {
            operationError = error.localizedDescription
        }
    }

    func save() {
        do {
            guard let store, let content, let specimen else {
                throw ShellError.invalid("Offline data is not ready.")
            }
            guard case .ready = storage else {
                throw ShellError.invalid("Resolve the collection storage error before saving.")
            }
            let saved = SavedSpecimen(
                specimenID: content.experience.specimen.id, state: specimen, note: note
            )
            let updated = try store.append(saved)
            storage = .ready(updated)
            operationError = nil
            confirmation = "Specimen saved on this device. The timestamp records save time, not age."
        } catch {
            operationError = error.localizedDescription
            reloadAfterFailure()
        }
    }

    func restore(_ saved: SavedSpecimen) {
        do {
            guard let content else { throw ShellError.invalid("Offline data is not ready.") }
            try saved.validate(allowedSpecimenID: content.experience.specimen.id)
            specimen = try SpecimenState(growth: saved.growth, adultLengthMm: saved.adultLengthMm)
            note = saved.note
            confirmation = "Saved settings restored. Saving again creates a new local entry."
        } catch {
            operationError = error.localizedDescription
        }
    }

    func erase() {
        do {
            guard let store else { throw ShellError.invalid("Storage is not ready.") }
            try store.erase()
            storage = .ready(nil)
            note = ""
            operationError = nil
            confirmation = "The local collection has been erased."
        } catch {
            operationError = error.localizedDescription
            reloadAfterFailure()
        }
    }

    private func reloadAfterFailure() {
        guard let store else { return }
        do {
            storage = .ready(try store.load())
        } catch {
            storage = .failed(error.localizedDescription)
        }
    }
}

private enum Museum {
    static let rose = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.95, green: 0.59, blue: 0.66, alpha: 1)
            : UIColor(red: 0.67, green: 0.28, blue: 0.36, alpha: 1)
    })
    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark
            ? Color(red: 0.10, green: 0.10, blue: 0.11)
            : Color(red: 0.97, green: 0.95, blue: 0.91)
    }
    static func panel(_ scheme: ColorScheme) -> Color {
        scheme == .dark
            ? Color(red: 0.15, green: 0.15, blue: 0.16)
            : Color(red: 1, green: 0.99, blue: 0.96)
    }
}

private struct MuseumCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Museum.panel(scheme), in: RoundedRectangle(cornerRadius: 24))
    }
}

private enum Moment: Int, CaseIterable, Identifiable {
    case discover, identify, builder, growth, meaning
    var id: Int { rawValue }
    var title: String {
        switch self {
        case .discover: return "Discover"
        case .identify: return "Identify"
        case .builder: return "The builder"
        case .growth: return "Growth"
        case .meaning: return "Remember"
        }
    }
    var heading: String {
        switch self {
        case .discover: return "A small world,\nheld in a shell."
        case .identify: return "A name, with care."
        case .builder: return "Imagine the builder."
        case .growth: return "Form is not a clock."
        case .meaning: return "What will you remember?"
        }
    }
}

struct ShellRootView: View {
    @StateObject private var model = ShellModel()
    @State private var moment: Moment = .discover
    @State private var showEvidence = false
    @State private var confirmErase = false
    @State private var mantle = 0.0
    @State private var yaw = Double.pi
    @State private var pitch = 0.0
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            Group {
                if let content = model.content, let specimen = model.specimen {
                    journey(content, specimen: specimen)
                } else if let error = model.startupError {
                    ContentUnavailableView {
                        Label("Offline exhibit unavailable", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry loading") { model.open() }
                    }
                } else {
                    ProgressView("Opening the offline exhibit")
                }
            }
            .background(Museum.background(scheme))
            .navigationTitle("The Shell Remembers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showEvidence = true
                    } label: {
                        Image(systemName: "text.book.closed")
                    }
                    .accessibilityLabel("Sources, scope and evidence")
                    .disabled(model.content == nil)
                }
            }
            .sheet(isPresented: $showEvidence) {
                if let content = model.content { EvidenceView(manifest: content.evidence) }
            }
            .alert("Could not complete action", isPresented: Binding(
                get: { model.operationError != nil },
                set: { if !$0 { model.operationError = nil } }
            )) {
                Button("OK") { model.operationError = nil }
            } message: {
                Text(model.operationError ?? "The action did not complete.")
            }
            .confirmationDialog(
                "Erase every locally saved specimen?",
                isPresented: $confirmErase, titleVisibility: .visible
            ) {
                Button("Erase local collection", role: .destructive) { model.erase() }
            } message: {
                Text("This removes this app's collection file, including unreadable data. This cannot be undone.")
            }
        }
        .tint(Museum.rose)
        .task { model.open() }
        .onChange(of: moment) { _, selected in
            if selected == .growth { yaw = .pi; pitch = 0 }
        }
        .onChange(of: model.confirmation) { _, message in
            if let message, UIAccessibility.isVoiceOverRunning {
                UIAccessibility.post(notification: .announcement, argument: message)
            }
        }
    }

    private func journey(_ content: ShellContent, specimen: SpecimenState) -> some View {
        let experience = content.experience
        let stage = experience.stage(for: specimen.growth)
        return ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Moment.allCases) { item in
                            Button {
                                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                                    moment = item
                                }
                            } label: {
                                Text("\(item.rawValue + 1) · \(item.title)")
                                    .font(.subheadline.weight(.medium))
                                    .padding(.horizontal, 16).padding(.vertical, 13)
                                    .background(
                                        moment == item ? Museum.rose : Museum.panel(scheme),
                                        in: Capsule()
                                    )
                                    .foregroundStyle(moment == item
                                        ? (scheme == .dark ? Color.black : Color.white)
                                        : Color.primary)
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(moment == item ? .isSelected : [])
                            .accessibilityLabel("Moment \(item.rawValue + 1) of 5. \(item.title)")
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("AN OFFLINE FIELD MUSEUM")
                        .font(.caption.weight(.semibold)).tracking(2)
                        .foregroundStyle(.secondary)
                    Text(moment.heading)
                        .font(.system(.largeTitle, design: .serif).weight(.medium))
                        .accessibilityAddTraits(.isHeader)
                }
                MuseumCard {
                    HStack(alignment: .firstTextBaseline) {
                        Text("DEMO \(String(format: "%02d", moment.rawValue + 1))")
                            .font(.caption.monospaced()).foregroundStyle(.secondary)
                        Spacer()
                        Text("Original illustration").font(.caption).foregroundStyle(.secondary)
                    }
                    ShellArtwork(
                        specimen: specimen, mantle: mantle, yaw: $yaw, pitch: $pitch
                    )
                    .frame(height: 285)
                    .accessibilityHidden(true)
                    Text("Conceptual \(stage.label.lowercased()) form. \(mantle > 0 ? "Rose teaching overlay visible." : "Teaching overlay hidden.") Age unknown.")
                        .font(.subheadline)
                        .accessibilityLabel("Illustration summary. \(stage.label) conceptual form. Growth progression \(Int(specimen.growth.value)) percent. Adult demo length is separately set to \(specimen.adultLengthMm) millimetres, not the illustrated stage's measured length. Age unknown. Mantle teaching overlay \(Int(mantle * 100)) percent.")
                    HStack {
                        Label("Drag to turn", systemImage: "hand.draw")
                            .font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Button("Reset to opening view") { yaw = .pi; pitch = 0 }
                            .font(.subheadline)
                            .frame(minHeight: 44)
                    }
                    Button("Turn shell a quarter turn") { yaw += .pi / 2 }
                        .font(.subheadline)
                        .frame(minHeight: 44)
                        .accessibilityHint("Accessible alternative to dragging the illustration.")
                    Text(experience.specimen.artworkNotice)
                        .font(.caption).foregroundStyle(.secondary)
                }
                momentContent(content, specimen: specimen)
                if let error = model.operationError {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.primary).padding()
                        .background(Museum.rose.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityLabel("Operation failed. \(error)")
                }
                if let confirmation = model.confirmation {
                    Label(confirmation, systemImage: "checkmark.circle")
                        .font(.subheadline).accessibilityLabel(confirmation)
                }
                if moment != .meaning {
                    Button {
                        if let next = Moment(rawValue: moment.rawValue + 1) { moment = next }
                    } label: {
                        HStack {
                            Text("Continue the journey")
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .padding(.vertical, 9)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .foregroundStyle(scheme == .dark ? Color.black : Color.white)
                }
                Button("Read all sources, scope & evidence") { showEvidence = true }
                    .font(.subheadline)
                Text("No camera. No account. No upload. Core experience works offline.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: 620)
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    @ViewBuilder
    private func momentContent(_ content: ShellContent, specimen: SpecimenState) -> some View {
        let experience = content.experience
        switch moment {
        case .discover:
            MuseumCard {
                Text(experience.specimen.commonName).font(.title2.weight(.medium))
                Text(experience.specimen.scientificName)
                    .font(.system(.body, design: .serif)).italic()
                Text(experience.specimen.identificationNotice)
                Text("Explore a selected demo, turn an original illustration, and keep a personal reflection. The visual model is not a specimen scan.")
                    .foregroundStyle(.secondary)
            }
        case .identify:
            MuseumCard {
                Label("Selected, not identified", systemImage: "questionmark.circle")
                    .font(.headline)
                Text(experience.specimen.identificationNotice)
                Text("This app does not identify an unknown shell. A look-alike cannot be ruled out from this illustration; do not treat the demo name as a determination of a shell you find.")
                Text("Evidence and demo limitations below retain their stated scope. Genus, species and subspecies evidence are not interchangeable.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(content.evidence.claims) { claim in
                MuseumCard {
                    ClaimText(claim: claim)
                    Button("Evidence for this statement") { showEvidence = true }
                        .font(.subheadline)
                }
            }
        case .builder:
            MuseumCard {
                Text("A living mantle / a visual abstraction").font(.title2)
                Text("Reveal a rose teaching layer around the illustrated shell. Its color, pattern and coverage are artistic choices, not a natural mantle color claim or a reconstruction.")
                Slider(value: $mantle, in: 0...1, step: 0.05) {
                    Text("Mantle teaching overlay")
                } minimumValueLabel: {
                    Text("Hidden").font(.caption)
                } maximumValueLabel: {
                    Text("Revealed").font(.caption)
                }
                .accessibilityValue("\(Int(mantle * 100)) percent revealed")
                Text("Teaching overlay: \(Int(mantle * 100))%")
                    .font(.subheadline.monospacedDigit())
                Text("The procedural opening, coils, lip marks and outer surface are simplified anatomy abstractions. For biological statements, read the sourced evidence rather than the artwork.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button("Read verified biology and its scope") { showEvidence = true }
            }
        case .growth:
            growthControls(content, specimen: specimen)
        case .meaning:
            collectionView(experience, specimen: specimen)
        }
    }

    private func growthControls(_ content: ShellContent, specimen: SpecimenState) -> some View {
        let experience = content.experience
        let stage = experience.stage(for: specimen.growth)
        return VStack(spacing: 20) {
            MuseumCard {
                Text(stage.label).font(.title2)
                Text(stage.caption).font(.headline)
                Text(stage.description)
                Slider(value: Binding(
                    get: { model.specimen?.growth.value ?? specimen.growth.value },
                    set: model.changeGrowth
                ), in: 0...100, step: 1) {
                    Text("Conceptual growth progression")
                } minimumValueLabel: {
                    Text("0").font(.caption)
                } maximumValueLabel: {
                    Text("100").font(.caption)
                }
                .accessibilityValue("\(Int(specimen.growth.value)) percent, \(stage.label). Not elapsed time.")
                Text("Progression \(Int(specimen.growth.value)) / 100 · not a measured growth curve")
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                Text("The juvenile/coiled to adult/involute transition is approximate. No months or years are assigned to any slider position.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Text("Below progression 75, a rose outline follows the illustrated opening edge as it narrows. It is a conceptual teaching highlight, not natural color or a measured growth rate.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            MuseumCard {
                Text("Adult demo length").font(.title2)
                Text("\(specimen.adultLengthMm) mm")
                    .font(.system(.largeTitle, design: .serif).monospacedDigit())
                Slider(value: Binding(
                    get: { Double(model.specimen?.adultLengthMm ?? specimen.adultLengthMm) },
                    set: model.changeLength
                ), in: Double(experience.measurement.minMm)...Double(experience.measurement.maxMm),
                       step: Double(experience.measurement.stepMm)) {
                    Text("Independent adult demo length, millimetres")
                } minimumValueLabel: {
                    Text("\(experience.measurement.minMm)").font(.caption)
                } maximumValueLabel: {
                    Text("\(experience.measurement.maxMm)").font(.caption)
                }
                .accessibilityValue("\(specimen.adultLengthMm) millimetres. Independent of growth progression.")
                Text(experience.specimen.measurementNotice)
                Text("Length scales the illustration against a fixed frame. It does not change the conceptual stage or reveal age.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Divider()
                sizeReference(content, specimen: specimen)
                Divider()
                ForEach(experience.measurement.comparisonLengthsMm, id: \.self) { length in
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Chosen comparison · \(length) mm").font(.caption)
                        GeometryReader { proxy in
                            Capsule().fill(Museum.rose.opacity(0.5))
                                .frame(width: proxy.size.width * Double(length) / 160, height: 6)
                        }
                        .frame(height: 6).accessibilityHidden(true)
                    }
                }
                Text(experience.measurement.comparisonNotice)
                    .font(.caption).foregroundStyle(.secondary)
                Divider()
                LabeledContent("Chronological age", value: specimen.chronologicalAge)
                    .font(.headline)
                Text(experience.ageNotice).font(.subheadline)
            }
        }
    }

    private func sizeReference(_ content: ShellContent, specimen: SpecimenState) -> some View {
        let guide = content.experience.sizeGuide
        let comparison = guide.comparison(for: specimen)
        return VStack(alignment: .leading, spacing: 12) {
            Text("One field reference").font(.headline)
            Text(comparison.title).font(.headline)
            Text(comparison.detail)
            Text(guide.notice).font(.subheadline).foregroundStyle(.secondary)
            Text("Reported average: approximately \(guide.reportedAverageMm) mm. Reported maximum: approximately \(guide.reportedMaximumMm) mm.")
                .font(.caption).foregroundStyle(.secondary)
            if let claim = content.evidence.claims.first(where: { $0.id == guide.claimId }) {
                DisclosureGroup("Source statement and full caveat") {
                    VStack(alignment: .leading, spacing: 12) {
                        ClaimText(claim: claim)
                        ForEach(content.evidence.sources(for: claim)) { source in
                            Text("\(source.title) · \(source.publisher)")
                                .font(.caption)
                        }
                        Button("Read source list and access notes") { showEvidence = true }
                            .font(.subheadline)
                    }
                    .padding(.top, 8)
                }
            }
        }
    }

    private func collectionView(_ experience: Experience, specimen: SpecimenState) -> some View {
        VStack(spacing: 20) {
            MuseumCard {
                Text("Keep a thought, not a birthday.").font(.title2)
                Text("What changed when you looked more closely?")
                TextField("Your reflection (optional)", text: $model.note, axis: .vertical)
                    .lineLimit(3...8)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Specimen reflection, maximum 280 text units")
                    .onChange(of: model.note) { _, _ in model.confirmation = nil }
                Text("\(model.note.utf16.count) / 280 text units")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(model.note.utf16.count > 280 ? Museum.rose : Color.secondary)
                Text("Some symbols use two or more text units.")
                    .font(.caption).foregroundStyle(.secondary)
                if model.note.utf16.count > 280 {
                    Text("Shorten your reflection to 280 text units before saving.")
                        .font(.subheadline)
                }
                Text("Saves the selected demo, conceptual progression \(Int(specimen.growth.value))/100, and independent adult length \(specimen.adultLengthMm) mm. Age remains unknown.")
                    .font(.subheadline)
                Text(experience.collectionNotice).font(.caption).foregroundStyle(.secondary)
                if case .ready = model.storage {
                    Button("Save specimen on this device") { model.save() }
                        .buttonStyle(.borderedProminent)
                        .foregroundStyle(scheme == .dark ? Color.black : Color.white)
                        .disabled(model.note.utf16.count > 280)
                }
            }
            MuseumCard {
                Text("Your local collection").font(.title2)
                switch model.storage {
                case .loading:
                    ProgressView("Reading local storage")
                case .failed(let error):
                    Label("Storage needs attention", systemImage: "exclamationmark.triangle")
                        .font(.headline)
                    Text(error)
                    Text("Saving is blocked so unreadable content is not overwritten. Retry, or explicitly erase the collection to start again.")
                        .font(.subheadline)
                    Button("Retry reading storage") { model.reloadCollection() }
                case .ready(let collection):
                    if let collection, !collection.specimens.isEmpty {
                        Text("\(collection.specimens.count) saved entries · on this device")
                            .font(.subheadline).foregroundStyle(.secondary)
                        ForEach(collection.specimens.reversed()) { saved in
                            VStack(alignment: .leading, spacing: 10) {
                                Divider()
                                Text(experience.specimen.commonName).font(.headline)
                                Text("Saved on \(saved.savedAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.subheadline)
                                Text("Save time, not specimen age.").font(.caption).foregroundStyle(.secondary)
                                Text("Conceptual progression \(Int(saved.growth))/100 · adult demo \(saved.adultLengthMm) mm · age unknown")
                                    .font(.subheadline)
                                if !saved.note.isEmpty { Text(saved.note) }
                                Button("Restore these settings") { model.restore(saved) }
                                    .font(.subheadline)
                            }
                        }
                    } else {
                        Label("No saved specimens yet", systemImage: "tray")
                        Text("Storage is ready. Your first save creates a local collection file.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                Button("Erase local collection", role: .destructive) { confirmErase = true }
                    .font(.subheadline)
            }
        }
    }
}

private struct ClaimText: View {
    let claim: ClaimManifest.Claim
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(claim.text)
            Text("Scope: \(claim.scope)").font(.subheadline.weight(.semibold))
            Text("Confidence: \(claim.confidence)").font(.caption)
            Text(claim.evidenceNote).font(.subheadline).foregroundStyle(.secondary)
        }
    }
}

private struct EvidenceView: View {
    let manifest: ClaimManifest
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("How to read this exhibit") {
                    Text("Source-supported text is bundled below with its scope and evidence notes. The illustration is original and conceptual, not evidence. External citation links require a browser connection; the exhibit and notes do not.")
                }
                ForEach(manifest.claims) { claim in
                    Section("Statement · \(claim.id)") {
                        ClaimText(claim: claim)
                        if claim.sourceIds.isEmpty {
                            Text("Demo limitation. No biological inference is asserted.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        ForEach(manifest.sources(for: claim)) { source in
                            Text("Source: \(source.title) · \(source.publisher)")
                                .font(.caption)
                        }
                    }
                }
                Section("Source list · bundled offline") {
                    ForEach(manifest.sources) { source in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(source.title).font(.headline)
                            Text(source.publisher)
                            Text("Source ID: \(source.id) · \(source.kind)").font(.caption)
                            Text("Accessed: \(source.accessedAt)").font(.caption)
                            Text(source.accessNote.isEmpty
                                 ? "No additional access note supplied." : source.accessNote)
                                .font(.subheadline)
                            Text(source.url).font(.caption).textSelection(.enabled)
                            if let url = URL(string: source.url) {
                                Link("Open external citation", destination: url)
                                    .font(.subheadline)
                            }
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
            .navigationTitle("Sources & scope")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
