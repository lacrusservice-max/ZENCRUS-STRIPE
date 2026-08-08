// OCR con Vision (macOS) para el SMAE escaneado.
//
// El PDF del SMAE es un escaneo cuya capa de texto está rota: sale invertida
// («orofsóF» por «Fósforo») y los números son ruido. Las imágenes, en cambio,
// son de 400 dpi. Vision reconoce el español y devuelve la caja de cada línea,
// que es lo que permite separar columnas por coordenadas en vez de por orden de
// lectura — el mismo principio que ya salvó la extracción del INCMNSZ.
//
// Salida: un JSON por imagen con {text, x, y, w, h, conf} por línea.

import Foundation
import Vision
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty else {
    FileHandle.standardError.write("uso: ocr_vision <imagen.png> [...]\n".data(using: .utf8)!)
    exit(2)
}

var salida: [[String: Any]] = []

for ruta in args {
    guard let img = NSImage(contentsOfFile: ruta),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        FileHandle.standardError.write("no se pudo abrir \(ruta)\n".data(using: .utf8)!)
        continue
    }

    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["es-ES", "en-US"]
    req.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do { try handler.perform([req]) } catch {
        FileHandle.standardError.write("fallo OCR en \(ruta): \(error)\n".data(using: .utf8)!)
        continue
    }

    var lineas: [[String: Any]] = []
    for obs in (req.results ?? []) {
        guard let mejor = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox   // normalizado, origen abajo-izquierda
        lineas.append([
            "text": mejor.string,
            "conf": mejor.confidence,
            "x": b.origin.x,
            // Se pasa a origen arriba-izquierda, que es como se agrupan las filas.
            "y": 1.0 - b.origin.y - b.size.height,
            "w": b.size.width,
            "h": b.size.height,
        ])
    }
    salida.append(["file": ruta, "lines": lineas])
}

let datos = try JSONSerialization.data(withJSONObject: salida, options: [])
FileHandle.standardOutput.write(datos)
