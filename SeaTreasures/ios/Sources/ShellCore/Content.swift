import Foundation

public enum ShellError: LocalizedError, Equatable {
    case invalid(String)
    case missingResource(String)
    case corruptCollection(String)

    public var errorDescription: String? {
        switch self {
        case .invalid(let reason): return "Invalid data: \(reason)"
        case .missingResource(let name): return "The offline resource \(name) is missing."
        case .corruptCollection(let reason):
            return "The local collection could not be read. Nothing was replaced. \(reason)"
        }
    }
}

private func require(_ condition: Bool, _ reason: String) throws {
    guard condition else { throw ShellError.invalid(reason) }
}

private func nonempty(_ value: String) -> Bool {
    !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
}

public struct Experience: Codable, Sendable {
    public struct Specimen: Codable, Sendable {
        public let id: String
        public let commonName: String
        public let scientificName: String
        public let defaultLengthMm: Int
        public let identificationNotice: String
        public let measurementNotice: String
        public let artworkNotice: String
    }

    public struct Measurement: Codable, Sendable {
        public let minMm: Int
        public let maxMm: Int
        public let stepMm: Int
        public let comparisonLengthsMm: [Int]
        public let comparisonNotice: String
    }

    public struct SizeGuide: Codable, Sendable {
        public let claimId: String
        public let reportedAverageMm: Int
        public let largeAboveMm: Int
        public let nearMaximumFromMm: Int
        public let reportedMaximumMm: Int
        public let notice: String
    }

    public struct Stage: Codable, Identifiable, Sendable {
        public let id: String
        public let label: String
        public let startsAt: Double
        public let caption: String
        public let description: String
    }

    public let version: Int
    public let specimen: Specimen
    public let measurement: Measurement
    public let sizeGuide: SizeGuide
    public let stages: [Stage]
    public let ageNotice: String
    public let collectionNotice: String

    public func validate() throws {
        try require(version == 1, "Unsupported experience version.")
        try require([
            specimen.id, specimen.commonName, specimen.scientificName,
            specimen.identificationNotice, specimen.measurementNotice,
            specimen.artworkNotice, measurement.comparisonNotice, ageNotice, collectionNotice
        ].allSatisfy(nonempty), "Experience text must not be empty.")
        try require(
            measurement.minMm == 50 && measurement.maxMm == 160 && measurement.stepMm == 1
                && specimen.defaultLengthMm == 110,
            "Unsupported adult demo measurement bounds."
        )
        try require(measurement.comparisonLengthsMm == [90, 120, 150],
                    "Unexpected illustrative comparisons.")
        try require([sizeGuide.claimId, sizeGuide.notice].allSatisfy(nonempty),
                    "The size guide needs an evidence claim and limitation notice.")
        try require(
            measurement.minMm <= sizeGuide.reportedAverageMm
                && sizeGuide.reportedAverageMm <= sizeGuide.largeAboveMm
                && sizeGuide.largeAboveMm < sizeGuide.nearMaximumFromMm
                && sizeGuide.nearMaximumFromMm <= sizeGuide.reportedMaximumMm
                && sizeGuide.reportedMaximumMm <= measurement.maxMm,
            "Size guide thresholds must be ordered within the adult demo measurement bounds."
        )
        try require(stages.map(\.startsAt) == [0, 25, 50, 75],
                    "Conceptual stages must start at 0, 25, 50 and 75.")
        try require(Set(stages.map(\.id)).count == stages.count,
                    "Stage identifiers must be unique.")
        try require(stages.allSatisfy {
            [$0.id, $0.label, $0.caption, $0.description].allSatisfy(nonempty)
        }, "Stage text must not be empty.")
    }

    public func stage(for progress: GrowthProgress) -> Stage {
        stages.last(where: { progress.value >= $0.startsAt }) ?? stages[0]
    }
}

public struct ClaimManifest: Codable, Sendable {
    public struct Source: Codable, Identifiable, Sendable {
        public let id: String
        public let title: String
        public let publisher: String
        public let url: String
        public let accessedAt: String
        public let kind: String
        public let accessNote: String
    }

    public struct Claim: Codable, Identifiable, Sendable {
        public let id: String
        public let text: String
        public let sourceIds: [String]
        public let scope: String
        public let confidence: String
        public let evidenceNote: String
    }

    public let version: Int
    public let sources: [Source]
    public let claims: [Claim]

    public func validate() throws {
        try require(version == 1, "Unsupported claim manifest version.")
        try require(!sources.isEmpty && !claims.isEmpty, "Evidence cannot be empty.")
        let sourceIDs = Set(sources.map(\.id))
        try require(sourceIDs.count == sources.count, "Duplicate source identifier.")
        try require(Set(claims.map(\.id)).count == claims.count, "Duplicate claim identifier.")
        for source in sources {
            try require([
                source.id, source.title, source.publisher, source.url, source.accessedAt,
                source.kind
            ].allSatisfy(nonempty), "Source metadata must not be empty.")
            let url = URL(string: source.url)
            try require(url?.host != nil && url?.scheme == "https",
                        "Source \(source.id) needs a valid HTTPS citation URL.")
            let date = String(source.accessedAt.prefix(10))
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.isLenient = false
            try require(formatter.date(from: date).map { formatter.string(from: $0) == date } == true,
                        "Source \(source.id) needs an access date.")
        }
        for claim in claims {
            try require([claim.id, claim.text, claim.scope, claim.confidence, claim.evidenceNote]
                .allSatisfy(nonempty), "Claims must include scope, confidence and evidence notes.")
            try require((!claim.sourceIds.isEmpty || claim.scope == "demo-limitation")
                && Set(claim.sourceIds).count == claim.sourceIds.count
                && claim.sourceIds.allSatisfy(sourceIDs.contains),
                        "Claim \(claim.id) has missing or duplicate source references. Only demo limitations may omit citations.")
        }
    }

    public func sources(for claim: Claim) -> [Source] {
        sources.filter { claim.sourceIds.contains($0.id) }
    }
}

public struct ShellContent: Sendable {
    public let experience: Experience
    public let evidence: ClaimManifest

    public static func decode(experience: Data, claims: Data) throws -> ShellContent {
        let decoder = JSONDecoder()
        let experience = try decoder.decode(Experience.self, from: experience)
        let evidence = try decoder.decode(ClaimManifest.self, from: claims)
        try experience.validate()
        try evidence.validate()
        try require(evidence.claims.contains {
            $0.id == experience.sizeGuide.claimId && !$0.sourceIds.isEmpty
        }, "The size guide must reference an existing, sourced evidence claim.")
        return ShellContent(experience: experience, evidence: evidence)
    }

    public static func bundled() throws -> ShellContent {
        func resource(_ name: String) throws -> Data {
            guard let url = Bundle.module.url(forResource: name, withExtension: "json") else {
                throw ShellError.missingResource("\(name).json")
            }
            return try Data(contentsOf: url)
        }
        return try decode(experience: resource("experience"), claims: resource("claims"))
    }
}
