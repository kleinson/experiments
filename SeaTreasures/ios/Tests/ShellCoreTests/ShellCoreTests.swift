import Foundation
import Testing
@testable import ShellCore

struct ShellCoreTests {
    @Test func canonicalBundledContentHasScopedEvidence() throws {
        let content = try ShellContent.bundled()
        #expect(content.experience.version == 1)
        #expect(content.experience.specimen.id == "hawaiian-tiger-cowrie-demo")
        #expect(content.experience.specimen.defaultLengthMm == 110)
        #expect(content.experience.measurement.comparisonLengthsMm == [90, 120, 150])
        let guide = content.experience.sizeGuide
        #expect(guide.claimId == "size-reference-schilderiana")
        #expect(guide.reportedAverageMm == 100)
        #expect(guide.largeAboveMm == 125)
        #expect(guide.nearMaximumFromMm == 150)
        #expect(guide.reportedMaximumMm == 153)
        #expect(!guide.notice.isEmpty)
        #expect(content.evidence.claims.contains { $0.id == guide.claimId && !$0.sourceIds.isEmpty })
        #expect(!content.experience.ageNotice.isEmpty)
        #expect(!content.evidence.sources.isEmpty)
        #expect(!content.evidence.claims.isEmpty)
        for claim in content.evidence.claims {
            #expect(!claim.scope.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            #expect(!claim.evidenceNote.isEmpty)
            #expect(!claim.confidence.isEmpty)
            #expect(Set(content.evidence.sources(for: claim).map(\.id)) == Set(claim.sourceIds))
        }
    }

    @Test func manifestRejectsDanglingSourceReferences() throws {
        try assertInvalidManifest { object in
            var claims = try #require(object["claims"] as? [[String: Any]])
            claims[0]["sourceIds"] = ["source-that-does-not-exist"]
            object["claims"] = claims
        }
    }

    @Test func manifestRequiresScopeAndEvidenceNotes() throws {
        for key in ["scope", "evidenceNote", "confidence"] {
            try assertInvalidManifest { object in
                var claims = try #require(object["claims"] as? [[String: Any]])
                claims[0][key] = "  "
                object["claims"] = claims
            }
        }
    }

    @Test func onlyDemoLimitationsMayOmitSourceReferences() throws {
        let content = try ShellContent.bundled()
        var object = try jsonObject(JSONEncoder().encode(content.evidence))
        var claims = try #require(object["claims"] as? [[String: Any]])
        claims[0]["sourceIds"] = []
        claims[0]["scope"] = "demo-limitation"
        object["claims"] = claims
        _ = try ShellContent.decode(
            experience: JSONEncoder().encode(content.experience),
            claims: JSONSerialization.data(withJSONObject: object)
        )
        claims[0]["scope"] = "species"
        object["claims"] = claims
        #expect(throws: (any Error).self) {
            try ShellContent.decode(
                experience: JSONEncoder().encode(content.experience),
                claims: JSONSerialization.data(withJSONObject: object)
            )
        }
    }

    @Test func manifestRejectsDuplicateIDsUnsafeURLsAndInvalidDates() throws {
        try assertInvalidManifest { object in
            var sources = try #require(object["sources"] as? [[String: Any]])
            sources.append(try #require(sources.first))
            object["sources"] = sources
        }
        for url in ["file:///private/local-data", "http://example.org"] {
            try assertInvalidManifest { object in
                var sources = try #require(object["sources"] as? [[String: Any]])
                sources[0]["url"] = url
                object["sources"] = sources
            }
        }
        try assertInvalidManifest { object in
            var sources = try #require(object["sources"] as? [[String: Any]])
            sources[0]["accessedAt"] = "2026-02-30"
            object["sources"] = sources
        }
        try assertInvalidManifest { object in object["version"] = 2 }
    }

    @Test func canonicalStageBoundaries() throws {
        let experience = try ShellContent.bundled().experience
        for (value, stageIndex) in [
            (0.0, 0), (24.999, 0), (25, 1), (49.999, 1),
            (50, 2), (74.999, 2), (75, 3), (100, 3)
        ] {
            #expect(experience.stage(for: try GrowthProgress(value)).id
                    == experience.stages[stageIndex].id)
        }
        #expect(experience.stage(for: try GrowthProgress(-20)).id == experience.stages[0].id)
        #expect(experience.stage(for: try GrowthProgress(120)).id == experience.stages[3].id)
    }

    @Test func rejectsNoncanonicalStageBoundaries() throws {
        let content = try ShellContent.bundled()
        var object = try jsonObject(JSONEncoder().encode(content.experience))
        var stages = try #require(object["stages"] as? [[String: Any]])
        stages[1]["startsAt"] = 26
        object["stages"] = stages
        #expect(throws: (any Error).self) {
            try ShellContent.decode(
                experience: JSONSerialization.data(withJSONObject: object),
                claims: JSONEncoder().encode(content.evidence)
            )
        }
    }

    @Test func growthClampsFiniteValuesAndRejectsNonfiniteValues() throws {
        #expect(try GrowthProgress(-100).value == 0)
        #expect(try GrowthProgress(1_000).value == 100)
        #expect(try GrowthProgress(Double.greatestFiniteMagnitude).value == 100)
        for value in [Double.nan, .infinity, -.infinity] {
            #expect(throws: (any Error).self) { try GrowthProgress(value) }
        }
    }

    @Test func conceptualGrowthEdgeEndsAtProgression75() throws {
        for value in [-10.0, 0, 25, 50, 74, 74.999] {
            #expect(try GrowthProgress(value).showsConceptualGrowthEdge)
        }
        for value in [75.0, 75.001, 100, 200] {
            #expect(try !GrowthProgress(value).showsConceptualGrowthEdge)
        }
    }

    @Test func illustrationMathMatchesSharedModelAcrossFullRange() throws {
        for value in stride(from: 0.0, through: 100.0, by: 0.5) {
            let shape = try GrowthProgress(value).shape
            let t = value / 100
            #expect(abs(shape.scale - (0.38 + 0.62 * t)) < 1e-12)
            #expect(abs(shape.width - (0.62 + 0.12 * t)) < 1e-12)
            #expect(abs(shape.height - (0.5 + 0.22 * t)) < 1e-12)
            #expect(abs(shape.opening - (0.72 - 0.64 * t)) < 1e-12)
            #expect(abs(shape.coilVisibility - max(0, 1 - 2.4 * t)) < 1e-12)
            #expect(abs(shape.teeth - min(1, max(0, (t - 0.4) / 0.6))) < 1e-12)
            let allFinite = [shape.scale, shape.width, shape.height, shape.opening,
                             shape.coilVisibility, shape.teeth].allSatisfy(\.isFinite)
            #expect(allFinite)
        }
    }

    @Test func adultSizeAndConceptualStageAreIndependentAndAgeUnknown() throws {
        var state = try SpecimenState()
        #expect(state.adultLengthMm == 110)
        #expect(state.growth.value == 100)
        try state.setGrowth(12)
        #expect(state.adultLengthMm == 110)
        let shape = state.growth.shape
        try state.setAdultLength(160)
        #expect(state.growth.value == 12)
        #expect(state.growth.shape == shape)
        #expect(state.chronologicalAge == "Unknown")
        try state.setAdultLength(50)
        #expect(state.growth.value == 12)
        #expect(throws: (any Error).self) { try state.setAdultLength(49) }
        #expect(throws: (any Error).self) { try state.setAdultLength(161) }
        #expect(state.adultLengthMm == 50)
        #expect(throws: (any Error).self) { try state.setGrowth(.nan) }
        #expect(state.growth.value == 12)
    }

    @Test func sizeReferenceUsesExactBoundariesAndDifferences() throws {
        let guide = try ShellContent.bundled().experience.sizeGuide
        for (length, category) in [
            (50, SizeComparison.Category.reference), (99, .reference), (100, .reference),
            (110, .reference), (125, .reference), (126, .large), (149, .large),
            (150, .nearMaximum), (151, .nearMaximum), (153, .nearMaximum),
            (154, .beyondReference), (160, .beyondReference)
        ] {
            let comparison = guide.comparison(for: try SpecimenState(adultLengthMm: length))
            #expect(comparison.category == category)
        }
        let defaultComparison = guide.comparison(for: try SpecimenState())
        #expect(defaultComparison.detail == "110 mm is 10 mm longer than its approximate 100 mm adult average. That alone does not establish maturity or age.")
        let shorter = guide.comparison(for: try SpecimenState(adultLengthMm: 90))
        #expect(shorter.detail.contains("10 mm shorter"))
        let average = guide.comparison(for: try SpecimenState(adultLengthMm: 100))
        #expect(average.title == "At the cited average.")
        for length in [150, 151, 152, 153] {
            let comparison = guide.comparison(for: try SpecimenState(adultLengthMm: length))
            #expect(comparison.detail == "\(length) mm is \(153 - length) mm below this reference's 153 mm maximum. That does not establish rarity or age.")
        }
        let large = guide.comparison(for: try SpecimenState(adultLengthMm: 126))
        #expect(large.detail.contains("not a measured population percentile"))
        let beyond = guide.comparison(for: try SpecimenState(adultLengthMm: 154))
        #expect(beyond.detail == "154 mm is above the cited 153 mm maximum. Recheck length and identification; this is not a record claim.")
    }

    @Test func adultLengthVisuallyScalesWithoutChangingStageOrAge() throws {
        let experience = try ShellContent.bundled().experience
        for growth in [0.0, 24, 25, 49, 50, 74, 75, 100] {
            let smaller = try SpecimenState(growth: growth, adultLengthMm: 90)
            let larger = try SpecimenState(growth: growth, adultLengthMm: 150)
            #expect(abs(smaller.adultReferenceScale - 90.0 / 110) < 1e-12)
            #expect(abs(larger.adultReferenceScale - 150.0 / 110) < 1e-12)
            #expect(abs(larger.illustrationScale / smaller.illustrationScale - 150.0 / 90) < 1e-12)
            #expect(smaller.growth.shape == larger.growth.shape)
            #expect(experience.stage(for: smaller.growth).id == experience.stage(for: larger.growth).id)
            #expect(smaller.chronologicalAge == "Unknown")
            #expect(larger.chronologicalAge == "Unknown")
            let shape = smaller.growth.shape
            #expect(abs((shape.width * larger.illustrationScale)
                        / (shape.width * smaller.illustrationScale) - 150.0 / 90) < 1e-12)
            #expect(abs((shape.height * larger.illustrationScale)
                        / (shape.height * smaller.illustrationScale) - 150.0 / 90) < 1e-12)
        }
        let reference = try SpecimenState()
        #expect(reference.adultReferenceScale == 1)
        #expect(reference.illustrationScale == reference.growth.shape.scale)
    }

    @Test func framingUsesFixedMaximumRatherThanSelectedLength() throws {
        let maximumScale = SpecimenState.maximumReferenceScale
        #expect(abs(maximumScale - 160.0 / 110) < 1e-12)
        let fixedFrameUnit = SpecimenState.illustrationFrameScale
        for length in [50, 90, 110, 150, 160] {
            let state = try SpecimenState(adultLengthMm: length)
            let normalizedHeight = fixedFrameUnit * state.illustrationScale
            #expect(abs(normalizedHeight - 0.70 * Double(length) / 160) < 1e-12)
            #expect(normalizedHeight <= 0.70)
        }
        #expect(abs(fixedFrameUnit * maximumScale - 0.70) < 1e-12)
    }

    @Test func sizeReferenceComparisonIsIndependentOfConceptualStage() throws {
        let experience = try ShellContent.bundled().experience
        var state = try SpecimenState(adultLengthMm: 150)
        let comparison = experience.sizeGuide.comparison(for: state)
        for growth in [0.0, 24, 25, 49, 50, 74, 75, 100] {
            try state.setGrowth(growth)
            #expect(experience.sizeGuide.comparison(for: state) == comparison)
            #expect(state.chronologicalAge == "Unknown")
            let stage = experience.stage(for: state.growth).id
            let shape = state.growth.shape
            try state.setAdultLength(154)
            #expect(experience.sizeGuide.comparison(for: state).category == .beyondReference)
            #expect(experience.stage(for: state.growth).id == stage)
            #expect(state.growth.shape == shape)
            try state.setAdultLength(150)
        }
    }

    @Test func sizeGuideRejectsInvalidThresholdsAndMissingMetadata() throws {
        let content = try ShellContent.bundled()
        for (key, value) in [
            ("reportedAverageMm", 0 as Any), ("largeAboveMm", 151 as Any),
            ("nearMaximumFromMm", 154 as Any), ("reportedMaximumMm", 161 as Any),
            ("reportedMaximumMm", Int.max as Any),
            ("notice", "" as Any), ("claimId", "" as Any)
        ] {
            var object = try jsonObject(JSONEncoder().encode(content.experience))
            var guide = try #require(object["sizeGuide"] as? [String: Any])
            guide[key] = value
            object["sizeGuide"] = guide
            #expect(throws: (any Error).self) {
                try ShellContent.decode(
                    experience: JSONSerialization.data(withJSONObject: object),
                    claims: JSONEncoder().encode(content.evidence)
                )
            }
        }
    }

    @Test func sizeGuideRequiresAnExistingSourcedClaim() throws {
        let content = try ShellContent.bundled()
        let unsourced = try #require(content.evidence.claims.first { $0.sourceIds.isEmpty })
        for claimID in ["missing-size-source", unsourced.id] {
            var object = try jsonObject(JSONEncoder().encode(content.experience))
            var guide = try #require(object["sizeGuide"] as? [String: Any])
            guide["claimId"] = claimID
            object["sizeGuide"] = guide
            #expect(throws: (any Error).self) {
                try ShellContent.decode(
                    experience: JSONSerialization.data(withJSONObject: object),
                    claims: JSONEncoder().encode(content.evidence)
                )
            }
        }
    }

    @Test func collectionRoundTripRecordsSaveTimeAndRestorableState() throws {
        try withStore { store in
            #expect(try store.load() == nil)
            let timestamp = Date()
            let entry = SavedSpecimen(
                specimenID: store.allowedSpecimenID,
                state: try SpecimenState(growth: 25, adultLengthMm: 150),
                note: "A small world.", savedAt: timestamp
            )
            let collection = try store.append(entry)
            #expect(collection.specimens.count == 1)
            let loaded = try #require(try store.load())
            #expect(loaded == collection)
            #expect(loaded.specimens[0].savedAt == timestamp)
            #expect(loaded.specimens[0].growth == 25)
            #expect(loaded.specimens[0].adultLengthMm == 150)
            #expect(loaded.specimens[0].note == "A small world.")
            try store.erase()
            #expect(try store.load() == nil)
            try store.erase()
        }
    }

    @Test func collectionValidatesNotesUsingSharedUTF16Limit() throws {
        try withStore { store in
            let state = try SpecimenState()
            let valid = SavedSpecimen(
                specimenID: store.allowedSpecimenID, state: state,
                note: String(repeating: "🐚", count: 140)
            )
            try valid.validate(allowedSpecimenID: store.allowedSpecimenID)
            for note in [String(repeating: "x", count: 281), String(repeating: "🐚", count: 141)] {
                let invalid = SavedSpecimen(
                    specimenID: store.allowedSpecimenID, state: state, note: note
                )
                #expect(throws: (any Error).self) { try store.append(invalid) }
            }
            #expect(try store.load() == nil)
        }
    }

    @Test func malformedStoredContentCannotBeOverwrittenBySave() throws {
        try withStore { store in
            let damaged = Data("{not a collection".utf8)
            try damaged.write(to: store.fileURL)
            do {
                _ = try store.load()
                Issue.record("Corrupt data was accepted.")
            } catch {
                guard case ShellError.corruptCollection = error else {
                    Issue.record("Expected explicit corruption, received \(error)")
                    return
                }
            }
            let valid = SavedSpecimen(
                specimenID: store.allowedSpecimenID, state: try SpecimenState(), note: ""
            )
            #expect(throws: (any Error).self) { try store.append(valid) }
            #expect(try Data(contentsOf: store.fileURL) == damaged)
            try store.erase()
            _ = try store.append(valid)
        }
    }

    @Test func storedCollectionRejectsInvalidValuesWithoutDiscarding() throws {
        try withStore { store in
            let entry = SavedSpecimen(
                specimenID: store.allowedSpecimenID, state: try SpecimenState(), note: ""
            )
            let encoded = try JSONEncoder().encode(SpecimenCollection(specimens: [entry]))
            for (key, value) in [
                ("growth", -1 as Any), ("growth", 101 as Any),
                ("adultLengthMm", 49 as Any), ("adultLengthMm", 160.5 as Any),
                ("specimenID", "unknown-specimen" as Any),
                ("note", String(repeating: "a", count: 281) as Any),
                ("savedAt", -100_000_000_000 as Any)
            ] {
                var object = try jsonObject(encoded)
                var specimens = try #require(object["specimens"] as? [[String: Any]])
                specimens[0][key] = value
                object["specimens"] = specimens
                let invalid = try JSONSerialization.data(withJSONObject: object)
                try invalid.write(to: store.fileURL)
                #expect(throws: (any Error).self) { try store.load() }
                #expect(try Data(contentsOf: store.fileURL) == invalid)
            }
            var object = try jsonObject(encoded)
            object["version"] = 999
            try JSONSerialization.data(withJSONObject: object).write(to: store.fileURL)
            #expect(throws: (any Error).self) { try store.load() }
            #expect(throws: (any Error).self) {
                try SpecimenCollection(specimens: [entry, entry])
                    .validate(allowedSpecimenID: store.allowedSpecimenID)
            }
        }
    }

    @Test func writeFailureIsExplicit() throws {
        try withStore { store in
            let blocker = store.fileURL.deletingLastPathComponent().appendingPathComponent("blocker")
            try Data("a file, not a directory".utf8).write(to: blocker)
            let inaccessibleStore = CollectionStore(
                fileURL: blocker.appendingPathComponent("collection.json"),
                allowedSpecimenID: store.allowedSpecimenID
            )
            let entry = SavedSpecimen(
                specimenID: store.allowedSpecimenID, state: try SpecimenState(), note: ""
            )
            #expect(throws: (any Error).self) { try inaccessibleStore.append(entry) }
            #expect(try Data(contentsOf: blocker) == Data("a file, not a directory".utf8))
        }
    }

    private func assertInvalidManifest(
        _ change: (inout [String: Any]) throws -> Void
    ) throws {
        let content = try ShellContent.bundled()
        var object = try jsonObject(JSONEncoder().encode(content.evidence))
        try change(&object)
        #expect(throws: (any Error).self) {
            try ShellContent.decode(
                experience: JSONEncoder().encode(content.experience),
                claims: JSONSerialization.data(withJSONObject: object)
            )
        }
    }

    private func jsonObject(_ data: Data) throws -> [String: Any] {
        try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func withStore(_ body: (CollectionStore) throws -> Void) throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ShellCoreTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer {
            do { try FileManager.default.removeItem(at: directory) }
            catch { Issue.record("Failed to clean test directory: \(error)") }
        }
        try body(CollectionStore(
            fileURL: directory.appendingPathComponent("collection.json"),
            allowedSpecimenID: "hawaiian-tiger-cowrie-demo"
        ))
    }
}
