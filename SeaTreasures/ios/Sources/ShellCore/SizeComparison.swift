import Foundation

public struct SizeComparison: Equatable, Sendable {
    public enum Category: String, Sendable {
        case reference
        case large
        case nearMaximum = "near-maximum"
        case beyondReference = "beyond-reference"
    }

    public let category: Category
    public let title: String
    public let detail: String
}

extension Experience.SizeGuide {
    public func comparison(for specimen: SpecimenState) -> SizeComparison {
        let length = specimen.adultLengthMm
        if length > reportedMaximumMm {
            return SizeComparison(
                category: .beyondReference,
                title: "Beyond this reference's reported maximum.",
                detail: "\(length) mm is above the cited \(reportedMaximumMm) mm maximum. Recheck length and identification; this is not a record claim."
            )
        }
        if length >= nearMaximumFromMm {
            return SizeComparison(
                category: .nearMaximum,
                title: "Close to the reported upper end.",
                detail: "\(length) mm is \(reportedMaximumMm - length) mm below this reference's \(reportedMaximumMm) mm maximum. That does not establish rarity or age."
            )
        }
        if length > largeAboveMm {
            return SizeComparison(
                category: .large,
                title: "Large against this field reference.",
                detail: "\(length) mm exceeds its roughly \(largeAboveMm) mm large-specimen marker. This is a comparison with one guide, not a measured population percentile."
            )
        }
        let difference = length - reportedAverageMm
        if difference == 0 {
            return SizeComparison(
                category: .reference,
                title: "At the cited average.",
                detail: "\(length) mm matches this guide's approximate adult average. An individual shell is not a population statistic."
            )
        }
        return SizeComparison(
            category: .reference,
            title: "An adult reference, in perspective.",
            detail: "\(length) mm is \(abs(difference)) mm \(difference > 0 ? "longer" : "shorter") than its approximate \(reportedAverageMm) mm adult average. That alone does not establish maturity or age."
        )
    }
}
