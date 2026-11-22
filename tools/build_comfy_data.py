#!/usr/bin/env python3
"""Build comfy-data.js from the ComfyUI workflow JSONs.

    python3 tools/build_comfy_data.py

Reads the four graphs in ~/Desktop/ComfyUI/workflow, keeps the nodes and links
the page draws, and writes window.XYC_COMFY for comfyui.html.
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = pathlib.Path("/Users/xx/Desktop/ComfyUI/workflow")
TARGET = ROOT / "comfy-data.js"

SPECS = [
    {
        "id": "basic",
        "file": "comfy/workflows/sdxl-turbo-basic.json",
        "source": "SDXL_Turbo_基础工作流.json",
        "name_en": "The baseline",
        "name_zh": "基础工作流",
        "tag_en": "512² · 4 steps",
        "tag_zh": "512² · 4 步",
        "desc_en": "A 512² pass in four steps. Start here.",
        "desc_zh": "512²，四步。从这里开始。",
        "steps": "4", "cfg": "2", "sampler": "euler", "scheduler": "normal",
        "denoise": "1.0", "resolution": "512 × 512",
        "pipe_en": ["Checkpoint", "Prompts", "Sample", "Decode", "Save"],
        "pipe_zh": ["模型", "提示词", "采样", "解码", "保存"],
    },
    {
        "id": "hq",
        "file": "comfy/workflows/sdxl-turbo-hq.json",
        "source": "SDXL_Turbo_高质量工作流.json",
        "name_en": "Two-pass, 1024²",
        "name_zh": "两段式 1024²",
        "tag_en": "768 → 1024 · 4 + 2 steps",
        "tag_zh": "768 → 1024 · 4 + 2 步",
        "desc_en": "768², upscale, refine. Cleaner edges.",
        "desc_zh": "768² 放大再细化，边缘更干净。",
        "steps": "4 + 2", "cfg": "2", "sampler": "euler", "scheduler": "normal",
        "denoise": "1.0 / 0.5", "resolution": "768 → 1024",
        "pipe_en": ["Checkpoint", "Prompts", "Sample", "Upscale", "Refine", "Decode"],
        "pipe_zh": ["模型", "提示词", "采样", "放大", "细化", "解码"],
    },
    {
        "id": "reference",
        "file": "comfy/workflows/sdxl-turbo-reference.json",
        "source": "SDXL_Turbo_参考图工作流.json",
        "name_en": "Reference, image-to-image",
        "name_zh": "参考图 · 图生图",
        "tag_en": "denoise 0.65",
        "tag_zh": "降噪 0.65",
        "desc_en": "Image-to-image at denoise 0.65.",
        "desc_zh": "图生图，降噪 0.65。",
        "steps": "4", "cfg": "2", "sampler": "euler", "scheduler": "normal",
        "denoise": "0.65", "resolution": "match reference",
        "pipe_en": ["Reference", "Prompts", "Sample", "Decode", "Save"],
        "pipe_zh": ["参考图", "提示词", "采样", "解码", "保存"],
    },
    {
        "id": "default",
        "file": "comfy/workflows/sdxl-turbo-default.json",
        "source": "SDXL_Turbo.json",
        "name_en": "Stock SDXL Turbo",
        "name_zh": "SDXL Turbo 原版",
        "tag_en": "512² · 1 step",
        "tag_zh": "512² · 1 步",
        "desc_en": "The stock one-step example.",
        "desc_zh": "官方的一步示例。",
        "steps": "1", "cfg": "1", "sampler": "euler_ancestral", "scheduler": "—",
        "denoise": "1.0", "resolution": "512 × 512",
        "pipe_en": ["Checkpoint", "Prompts", "Sample", "Decode", "Save"],
        "pipe_zh": ["模型", "提示词", "采样", "解码", "保存"],
    },
]


TITLE_EN = {
    "正面提示词 (Positive)": "Positive prompt",
    "负面提示词 (Negative)": "Negative prompt",
    "采样器 (SDXL Turbo专用设置)": "Sampler · SDXL Turbo",
    "图像尺寸 (提升到768x768)": "Latent size · 768²",
    "采样器 (4步高质量)": "Sampler · 4-step HQ",
    "Latent放大到1024x1024": "Latent upscale · 1024²",
    "细化采样器 (降噪0.5)": "Refine · denoise 0.5",
    "📸 上传参考图": "Reference image",
    "图像编码": "Image encode",
    "采样器 (降噪0.65保持相似度)": "Sampler · denoise 0.65",
    "VAE加载器": "VAE",
}


def build_workflow(spec):
    data = json.loads((SOURCE / spec["source"]).read_text(encoding="utf-8"))
    skipped = set()
    nodes = []
    for node in data.get("nodes", []):
        kind = node.get("type")
        if kind in ("Note", "MarkdownNote"):
            skipped.add(node.get("id"))
            continue
        pos = node.get("pos") or [0, 0]
        size = node.get("size") or [260, 90]
        widgets = node.get("widgets_values")
        if isinstance(widgets, list):
            cleaned = []
            for value in widgets:
                if isinstance(value, str) and len(value) > 240:
                    cleaned.append(value[:240] + "…")
                else:
                    cleaned.append(value)
            widgets = cleaned
        nodes.append({
            "id": node.get("id"),
            "type": kind,
            "title": node.get("title") or kind,
            "title_en": TITLE_EN.get(node.get("title") or "", node.get("title") or kind),
            "title_zh": node.get("title") or kind,
            "x": pos[0], "y": pos[1],
            "w": size[0], "h": size[1],
            "widgets": widgets,
            "inputs": len(node.get("inputs") or []),
            "outputs": len(node.get("outputs") or []),
        })

    links = [link for link in data.get("links", [])
             if link[1] not in skipped and link[3] not in skipped]

    clips = [n for n in data.get("nodes", [])
             if n.get("type") == "CLIPTextEncode" and n.get("widgets_values")]
    clips.sort(key=lambda n: len(str(n["widgets_values"][0])), reverse=True)
    prompt = str(clips[0]["widgets_values"][0]) if clips else ""
    negative = str(clips[1]["widgets_values"][0]) if len(clips) > 1 else ""

    out = {key: spec[key] for key in (
        "id", "file", "name_en", "name_zh", "tag_en", "tag_zh",
        "desc_en", "desc_zh", "steps", "cfg", "sampler", "scheduler",
        "denoise", "resolution", "pipe_en", "pipe_zh")}
    out.update({
        "prompt": prompt,
        "negative": negative,
        "nodes": nodes,
        "links": links,
        "nodeCount": len(nodes),
        "linkCount": len(links),
    })
    return out


def main():
    payload = {
        "image": {
            "src": "img/comfy/krea2.webp",
            "w": 1024, "h": 1024,
            "caption_en": "Krea 2 · int8 · 1024 × 1024 · one output from the bench",
            "caption_zh": "Krea 2 · int8 · 1024 × 1024 · 其中一张出图",
        },
        "workflows": [build_workflow(spec) for spec in SPECS],
    }
    TARGET.write_text(
        "/* generated by tools/build_comfy_data.py — edit the ComfyUI JSONs, then re-run */\n"
        "window.XYC_COMFY = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {TARGET} ({TARGET.stat().st_size} bytes)")
    for wf in payload["workflows"]:
        print(f"  {wf['id']:10s} {wf['nodeCount']} nodes · {wf['linkCount']} links · {wf['prompt'][:50]}")


if __name__ == "__main__":
    main()
