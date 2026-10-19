import SwiftUI
import ShellCore

/// Original procedural art; geometric features are teaching abstractions, not a scan.
struct ShellArtwork: View {
    let specimen: SpecimenState
    let mantle: Double
    @Binding var yaw: Double
    @Binding var pitch: Double
    @GestureState private var drag = CGSize.zero

    var body: some View {
        Canvas { context, size in
            let shape = specimen.growth.shape
            let turn = yaw + Double(drag.width) / 90
            let tilt = min(0.55, max(-0.55, pitch + Double(drag.height) / 240))
            let side = abs(cos(turn))
            // Fixed maximum-length framing leaves room for turning and the shadow.
            let unit = min(size.width, size.height) * SpecimenState.illustrationFrameScale
            let width = unit * shape.width * (0.55 + 0.45 * side)
            let height = unit * shape.height / 0.72 * (1 - abs(tilt) * 0.18)
            let rect = CGRect(x: -width / 2, y: -height / 2, width: width, height: height)
            context.translateBy(x: size.width / 2, y: size.height / 2)
            context.scaleBy(x: specimen.illustrationScale, y: specimen.illustrationScale)
            context.rotate(by: .radians(sin(turn) * 0.22 + tilt * 0.35))

            let shadow = Path(ellipseIn: CGRect(
                x: -width * 0.4, y: height * 0.48, width: width * 0.8, height: height * 0.10
            ))
            context.fill(shadow, with: .color(.black.opacity(0.10)))
            let body = Path(ellipseIn: rect)
            context.fill(body, with: .radialGradient(
                Gradient(colors: [
                    Color(red: 1, green: 0.97, blue: 0.86),
                    Color(red: 0.86, green: 0.76, blue: 0.64),
                    Color(red: 0.48, green: 0.35, blue: 0.32)
                ]),
                center: CGPoint(x: -width * 0.22, y: -height * 0.22),
                startRadius: 0, endRadius: max(width, height) * 0.78
            ))

            var surface = context
            surface.clip(to: body)
            if cos(turn) >= 0 {
                for index in 0..<78 {
                    let n = Double(index)
                    let angle = n * 2.399963
                    let radius = sqrt((n + 0.5) / 78) * 0.94
                    let x = cos(angle) * radius * width * 0.5
                    let y = sin(angle) * radius * height * 0.5
                    let spotWidth = width * (0.025 + 0.015 * abs(sin(n * 7.1)))
                    let spot = CGRect(
                        x: x - spotWidth / 2, y: y - spotWidth * 0.65,
                        width: spotWidth, height: spotWidth * 1.3
                    )
                    surface.fill(Path(ellipseIn: spot.insetBy(dx: -1.4, dy: -1.4)),
                                 with: .color(Color(red: 0.51, green: 0.28, blue: 0.24).opacity(0.25)))
                    surface.fill(Path(ellipseIn: spot),
                                 with: .color(Color(red: 0.25, green: 0.16, blue: 0.17).opacity(0.85)))
                }
                let highlight = Path(ellipseIn: CGRect(
                    x: -width * 0.30, y: -height * 0.37,
                    width: width * 0.23, height: height * 0.50
                ))
                surface.fill(highlight, with: .linearGradient(
                    Gradient(colors: [.white.opacity(0.45), .white.opacity(0)]),
                    startPoint: CGPoint(x: -width * 0.3, y: 0),
                    endPoint: CGPoint(x: width * 0.05, y: 0)
                ))
            }

            let apertureWidth = width * shape.opening * (cos(turn) < 0 ? 0.85 : 0.42)
            let apertureX = cos(turn) < 0 ? -apertureWidth / 2 : width * 0.22
            let aperture = CGRect(
                x: apertureX, y: -height * 0.40, width: apertureWidth, height: height * 0.80
            )
            let mouth = Path(ellipseIn: aperture)
            surface.fill(mouth, with: .linearGradient(
                Gradient(colors: [
                    Color(red: 0.25, green: 0.13, blue: 0.16),
                    Color(red: 0.60, green: 0.36, blue: 0.32)
                ]),
                startPoint: CGPoint(x: aperture.minX, y: 0),
                endPoint: CGPoint(x: aperture.maxX, y: 0)
            ))
            if specimen.growth.showsConceptualGrowthEdge {
                surface.stroke(
                    mouth,
                    with: .color(Color(red: 0.80, green: 0.40, blue: 0.47).opacity(0.8)),
                    lineWidth: 2
                )
            }
            if shape.teeth > 0 {
                for index in 0..<19 {
                    let y = -height * 0.34 + Double(index) / 18 * height * 0.68
                    let pinch = sqrt(max(0, 1 - pow(y / (height * 0.4), 2)))
                    let left = aperture.midX - apertureWidth * 0.5 * pinch
                    let right = aperture.midX + apertureWidth * 0.5 * pinch
                    var marks = Path()
                    marks.move(to: CGPoint(x: left - width * 0.04 * shape.teeth, y: y))
                    marks.addLine(to: CGPoint(x: left + width * 0.015, y: y + 1))
                    marks.move(to: CGPoint(x: right - width * 0.015, y: y))
                    marks.addLine(to: CGPoint(x: right + width * 0.04 * shape.teeth, y: y - 1))
                    surface.stroke(marks, with: .color(.white.opacity(0.8 * shape.teeth)),
                                   style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
                }
            }
            if shape.coilVisibility > 0 {
                var coil = Path()
                for index in 0...160 {
                    let t = Double(index) / 160
                    let angle = t * .pi * 5
                    let r = width * 0.26 * t
                    let point = CGPoint(x: cos(angle) * r - width * 0.08,
                                        y: sin(angle) * r - height * 0.20)
                    if index == 0 { coil.move(to: point) } else { coil.addLine(to: point) }
                }
                surface.stroke(coil, with: .color(.brown.opacity(shape.coilVisibility * 0.85)),
                               style: StrokeStyle(lineWidth: 2.8, lineCap: .round))
            }
            if mantle > 0 {
                var layer = context
                layer.clip(to: body)
                let rose = Color(red: 0.67, green: 0.28, blue: 0.36)
                for edge in [-1.0, 1.0] {
                    let overlay = CGRect(
                        x: edge < 0 ? -width * 0.60 : width * (0.50 - mantle * 0.49),
                        y: -height * 0.56,
                        width: width * (0.1 + mantle * 0.49), height: height * 1.12
                    )
                    layer.fill(Path(ellipseIn: overlay), with: .linearGradient(
                        Gradient(colors: [rose.opacity(0.85), rose.opacity(0.40)]),
                        startPoint: CGPoint(x: overlay.minX, y: 0),
                        endPoint: CGPoint(x: overlay.maxX, y: 0)
                    ))
                }
            }
            context.stroke(body, with: .color(.brown.opacity(0.25)), lineWidth: 1)
        }
        .contentShape(Rectangle())
        .gesture(
            DragGesture()
                .updating($drag) { value, state, _ in state = value.translation }
                .onEnded { value in
                    yaw = (yaw + Double(value.translation.width) / 90)
                        .truncatingRemainder(dividingBy: .pi * 2)
                    pitch = min(0.55, max(-0.55, pitch + Double(value.translation.height) / 240))
                }
        )
    }
}
