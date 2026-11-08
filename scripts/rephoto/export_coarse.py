"""Export LoFTR (outdoor) up to coarse matching, with fixed-size outputs, to ONNX.

For every coarse cell of image0 (one per 8x8 pixels) the model returns the best cell of image1,
the dual-softmax confidence, and whether the pair is a mutual best match. The caller keeps the
confident mutual pairs. No dynamic shapes, so it runs in onnxruntime anywhere.

Made models/loftr-coarse-352x480-fp16.onnx with:
  pip install torch kornia onnx onnxruntime
  python scripts/rephoto/export_coarse.py 352 480
LoFTR (Sun et al., CVPR 2021) and its outdoor weights are Apache-2.0, through kornia (Apache-2.0).
"""
import sys, time

import torch
import kornia.feature as KF

H = int(sys.argv[1]) if len(sys.argv) > 1 else 480
W = int(sys.argv[2]) if len(sys.argv) > 2 else 640


class Coarse(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.m = KF.LoFTR(pretrained="outdoor").eval()

    def forward(self, image0, image1):
        m = self.m
        f0, f1 = m._pair_features({"image0": image0, "image1": image1})
        c0, c1 = f0["coarse"], f1["coarse"]
        n, c, h, w = c0.shape
        c0 = c0.permute(0, 2, 3, 1).reshape(n, -1, c).contiguous()
        c1 = c1.permute(0, 2, 3, 1).reshape(n, -1, c).contiguous()
        c0, c1 = m.loftr_coarse(c0, c1, None, None)
        c0 = c0 / c ** 0.5
        c1 = c1 / c ** 0.5
        sim = torch.einsum("nlc,nsc->nls", c0, c1) / m.coarse_matching.temperature
        conf = torch.softmax(sim, 1) * torch.softmax(sim, 2)
        best, j = conf.max(dim=2)  # [1, L]
        _, i_back = conf.max(dim=1)  # [1, S]
        mutual = (torch.gather(i_back, 1, j) == torch.arange(j.shape[1])[None]).float()
        return j[0], best[0], mutual[0]


model = Coarse().eval()
a = torch.rand(1, 1, H, W)
b = torch.rand(1, 1, H, W)
path = f"loftr_coarse_{H}x{W}.onnx"
torch.onnx.export(model, (a, b), path, input_names=["image0", "image1"], output_names=["match", "confidence", "mutual"], opset_version=17, dynamo=False)

import onnxruntime as ort

sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
t = time.time()
out = sess.run(None, {"image0": a.numpy(), "image1": b.numpy()})
print(path, "run", f"{time.time() - t:.2f}s", [o.shape for o in out])

import onnx
from onnxruntime.transformers.float16 import convert_float_to_float16

onnx.save(convert_float_to_float16(onnx.load(path), keep_io_types=True), path.replace(".onnx", "_fp16.onnx"))
