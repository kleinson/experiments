import Foundation

public struct GrowthProgress: Equatable, Sendable {
    public let value: Double
    public var showsConceptualGrowthEdge: Bool { value < 75 }

    public init(_ value: Double) throws {
        guard value.isFinite else {
            throw ShellError.invalid("Growth progression must be finite.")
        }
        self.value = min(100, max(0, value))
    }

    public var shape: ShellShape {
        let t = value / 100
        return ShellShape(
            scale: 0.38 + 0.62 * t,
            width: 0.62 + 0.12 * t,
            height: 0.5 + 0.22 * t,
            opening: 0.72 - 0.64 * t,
            coilVisibility: max(0, 1 - 2.4 * t),
            teeth: min(1, max(0, (t - 0.4) / 0.6))
        )
    }
}

public struct ShellShape: Equatable, Sendable {
    public let scale: Double
    public let width: Double
    public let height: Double
    public let opening: Double
    public let coilVisibility: Double
    public let teeth: Double
}

public struct SpecimenState: Equatable, Sendable {
    public static let referenceLengthMm = 110
    public static let maximumAdultLengthMm = 160
    public static let maximumReferenceScale =
        Double(maximumAdultLengthMm) / Double(referenceLengthMm)
    public static let illustrationFrameScale = 0.70 / maximumReferenceScale

    public private(set) var growth: GrowthProgress
    public private(set) var adultLengthMm: Int
    public var chronologicalAge: String { "Unknown" }
    public var adultReferenceScale: Double {
        Double(adultLengthMm) / Double(Self.referenceLengthMm)
    }
    public var illustrationScale: Double { growth.shape.scale * adultReferenceScale }

    public init(growth: Double = 100, adultLengthMm: Int = 110) throws {
        self.growth = try GrowthProgress(growth)
        guard (50...160).contains(adultLengthMm) else {
            throw ShellError.invalid("Adult demo length must be an integer from 50 to 160 mm.")
        }
        self.adultLengthMm = adultLengthMm
    }

    public mutating func setGrowth(_ value: Double) throws {
        growth = try GrowthProgress(value)
    }

    public mutating func setAdultLength(_ value: Int) throws {
        guard (50...160).contains(value) else {
            throw ShellError.invalid("Adult demo length must be an integer from 50 to 160 mm.")
        }
        adultLengthMm = value
    }
}
