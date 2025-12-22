# GLM-4.6V Flash Tool Calling Guide

## The Right Model to Use

**Best Option for Your Setup:**

`MichelRosselli/GLM-4.6:Q2_K` (Ollama optimized version)

This is a quantized version of GLM-4.6 specifically prepared for Ollama with tool-calling support.

---

## Why Your Current glm4-9b Isn't Calling Tools

The `glm4-9b` you have is **not** the tool-calling version. It's a general chat model.

**GLM-4.6V-Flash HAS native function calling** but needs the right variant.

---

## How to Install in Ollama

Run this command:

```bash
ollama pull MichelRosselli/GLM-4.6:Q2_K
```

Or try the full name:

```bash
ollama pull michellrosselli/glm-4.6:q2_k
```

---

## Size & Requirements

- **Size:** ~6-7GB (Q2_K quantization)
- **VRAM needed:** 8GB minimum
- **Performance:** Faster than Q4_K, slight quality trade-off

---

## After Installation

1. **In LobeChat**, change Navi's model from `glm4-9b` to `GLM-4.6:Q2_K`

2. **Test with this command:**
   ```
   "List my tasks"
   ```

3. **What you should see:**
   - The model **actually invokes the tool** (not just talking about it)
   - Returns real data from your system
   - Shows the tool was called

---

## Key Features of This Version

✅ Native tool/function calling built-in  
✅ Optimized for Ollama  
✅ Works locally on your RTX 3060 Ti  
✅ 128K context window  
✅ MIT Licensed (free to use)  

---

## If Q2_K is Too Small (Lower Quality)

Try these alternatives:

**Option 2: Q4_K (Better Quality)**
```bash
ollama pull MichelRosselli/GLM-4.6:Q4_K
```
- Size: ~10GB
- Better quality, still fast

**Option 3: Full GLM-4.6V-Flash (Vision + Tools)**
```bash
ollama pull zai-org/GLM-4.6V-Flash
```
- Size: ~14-16GB
- Has vision capabilities
- Best tool calling
- More VRAM needed

---

## Troubleshooting

**If tool calling still doesn't work:**

1. Check the model is properly loaded:
   ```bash
   ollama list
   ```

2. Check MCP plugin is enabled for Navi

3. Test directly in terminal:
   ```bash
   ollama run michellrosselli/glm-4.6:q2_k "Can you list tasks?"
   ```

4. Check server logs for errors

---

## Reference Sources

- **Official:** https://ollama.com/MichelRosselli/GLM-4.6
- **GitHub:** https://github.com/zai-org/GLM-V
- **Hugging Face:** https://huggingface.co/zai-org/GLM-4.6V-Flash

---

## Summary

**Action Items:**

1. Run: `ollama pull MichelRosselli/GLM-4.6:Q2_K`
2. Wait for download (~6-7GB)
3. Switch Navi to use this model
4. Test with "List my tasks"
5. Tools should now invoke correctly

