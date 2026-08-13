import base64
import json
import os
import re
import statistics
import sys

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import cv2
import numpy as np
from paddleocr import PaddleOCR


def normalize_cell_text(value):
    text = str(value or "").strip()
    text = re.sub(r"^[?٧]\s*000$", "7.000", text)
    text = re.sub(r"(?<!\d)(\d{1,3})[ ,](\d{3})(?!\d)", r"\1.\2", text)
    return text


def group_cells(texts, scores, boxes, polygons):
    cells = []
    quantity_x = None
    slopes = []

    for polygon in polygons:
        top_left, top_right = polygon[0], polygon[1]
        width = float(top_right[0] - top_left[0])
        if width > 30:
            slope = float(top_right[1] - top_left[1]) / width
            if abs(slope) <= 0.3:
                slopes.append(slope)

    baseline_slope = statistics.median(slopes) if slopes else 0.0

    for text, score, box in zip(texts, scores, boxes):
        clean_text = normalize_cell_text(text)
        if not clean_text or float(score) < 0.3:
            continue

        left, top, right, bottom = [int(value) for value in box]
        cell = {
            "text": clean_text,
            "confidence": round(float(score), 4),
            "box": [[left, top], [right, top], [right, bottom], [left, bottom]],
            "left": left,
            "right": right,
            "top": top,
            "bottom": bottom,
            "center_x": (left + right) / 2,
            "center_y": (top + bottom) / 2,
            "row_y": (top + bottom) / 2 - baseline_slope * ((left + right) / 2),
            "height": max(1, bottom - top),
        }
        cells.append(cell)

        normalized_header = clean_text.casefold().replace(" ", "")
        if normalized_header in {"qty", "quantity", "الكمية"}:
            quantity_x = cell["center_x"]

    if quantity_x is not None:
        for cell in cells:
            if abs(cell["center_x"] - quantity_x) <= 45 and cell["text"] in {"I", "i", "l", "|"}:
                cell["text"] = "1"

    groups = []
    for cell in sorted(cells, key=lambda item: (item["row_y"], item["left"])):
        best_group = None
        best_distance = None
        for group in groups[-4:]:
            distance = abs(cell["row_y"] - group["row_y"])
            tolerance = max(8, min(cell["height"], group["height"]) * 0.45)
            if distance <= tolerance and (best_distance is None or distance < best_distance):
                best_group = group
                best_distance = distance

        if best_group is None:
            groups.append({"cells": [cell], "row_y": cell["row_y"], "height": cell["height"]})
        else:
            best_group["cells"].append(cell)
            count = len(best_group["cells"])
            best_group["row_y"] = (
                best_group["row_y"] * (count - 1) + cell["row_y"]
            ) / count
            best_group["height"] = max(best_group["height"], cell["height"])

    lines = []
    for group in sorted(groups, key=lambda item: item["row_y"]):
        row = sorted(group["cells"], key=lambda item: item["left"])
        text = " ".join(cell["text"] for cell in row).strip()
        if not text:
            continue

        left = min(cell["left"] for cell in row)
        top = min(cell["top"] for cell in row)
        right = max(cell["right"] for cell in row)
        bottom = max(cell["bottom"] for cell in row)
        lines.append({
            "text": text,
            "confidence": round(sum(cell["confidence"] for cell in row) / len(row), 4),
            "box": [[left, top], [right, top], [right, bottom], [left, bottom]],
        })

    return lines


def scan_image(ocr, encoded_image):
    image_bytes = base64.b64decode(encoded_image)
    image_array = cv2.imdecode(
        np.frombuffer(image_bytes, dtype="uint8"),
        cv2.IMREAD_COLOR,
    )
    if image_array is None:
        raise ValueError("Unable to decode receipt image")

    result = list(ocr.predict(image_array))[0].json["res"]
    lines = group_cells(
        result["rec_texts"],
        result["rec_scores"],
        result["rec_boxes"],
        result["rec_polys"],
    )
    return {
        "provider": "local-paddle-arabic-v5",
        "text": "\n".join(line["text"] for line in lines),
        "lines": lines,
    }


def emit(payload):
    print("JUICELIST_JSON:" + json.dumps(payload, ensure_ascii=False), flush=True)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ocr = PaddleOCR(
        lang="ar",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    print("JUICELIST_READY", flush=True)

    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            result = scan_image(ocr, request["image"])
            emit({"id": request["id"], "success": True, "result": result})
        except Exception as error:
            emit({"id": request.get("id") if "request" in locals() else None,
                  "success": False, "error": str(error)})


if __name__ == "__main__":
    main()
