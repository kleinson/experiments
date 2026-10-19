import Foundation

public struct SavedSpecimen: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let specimenID: String
    public let growth: Double
    public let adultLengthMm: Int
    public let note: String
    public let savedAt: Date

    public init(
        id: UUID = UUID(), specimenID: String, state: SpecimenState,
        note: String, savedAt: Date = Date()
    ) {
        self.id = id
        self.specimenID = specimenID
        growth = state.growth.value
        adultLengthMm = state.adultLengthMm
        self.note = note
        self.savedAt = savedAt
    }

    public func validate(allowedSpecimenID: String) throws {
        guard specimenID == allowedSpecimenID else {
            throw ShellError.invalid("Saved specimen does not match the selected demo.")
        }
        guard growth.isFinite && (0...100).contains(growth) else {
            throw ShellError.invalid("Saved growth must be finite and within 0...100.")
        }
        guard (50...160).contains(adultLengthMm) else {
            throw ShellError.invalid("Saved adult demo length is outside 50...160 mm.")
        }
        guard note.utf16.count <= 280 else {
            throw ShellError.invalid("Notes may contain at most 280 UTF-16 text units.")
        }
        guard savedAt.timeIntervalSince1970.isFinite
                && savedAt.timeIntervalSince1970 >= 0 else {
            throw ShellError.invalid("The save timestamp is invalid.")
        }
    }
}

public struct SpecimenCollection: Codable, Equatable, Sendable {
    public let version: Int
    public var specimens: [SavedSpecimen]

    public init(specimens: [SavedSpecimen] = []) {
        version = 1
        self.specimens = specimens
    }

    public func validate(allowedSpecimenID: String) throws {
        guard version == 1 else { throw ShellError.invalid("Unsupported collection version.") }
        guard Set(specimens.map(\.id)).count == specimens.count else {
            throw ShellError.invalid("Duplicate saved specimen identifier.")
        }
        for specimen in specimens {
            try specimen.validate(allowedSpecimenID: allowedSpecimenID)
        }
    }
}

public struct CollectionStore: Sendable {
    public let fileURL: URL
    public let allowedSpecimenID: String

    public init(fileURL: URL, allowedSpecimenID: String) {
        self.fileURL = fileURL
        self.allowedSpecimenID = allowedSpecimenID
    }

    /// A missing file is a first-use state, not a decoded empty collection.
    public func load() throws -> SpecimenCollection? {
        let data: Data
        do {
            data = try Data(contentsOf: fileURL)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return nil
        }
        do {
            let collection = try JSONDecoder().decode(SpecimenCollection.self, from: data)
            try collection.validate(allowedSpecimenID: allowedSpecimenID)
            return collection
        } catch {
            throw ShellError.corruptCollection(error.localizedDescription)
        }
    }

    @discardableResult
    public func append(_ specimen: SavedSpecimen) throws -> SpecimenCollection {
        try specimen.validate(allowedSpecimenID: allowedSpecimenID)
        var collection = try load() ?? SpecimenCollection()
        collection.specimens.append(specimen)
        try collection.validate(allowedSpecimenID: allowedSpecimenID)
        let data = try JSONEncoder().encode(collection)
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        #if os(iOS)
        var directory = fileURL.deletingLastPathComponent()
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        #endif
        try data.write(to: fileURL, options: .atomic)
        return collection
    }

    public func erase() throws {
        do {
            try FileManager.default.removeItem(at: fileURL)
        } catch let error as CocoaError where error.code == .fileNoSuchFile {
            return
        }
    }
}
