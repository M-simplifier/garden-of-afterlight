#include <stddef.h>
#include "raylib.h"

/* Compile with the same Emscripten compiler and raylib.h as the browser host. */
_Static_assert(offsetof(Mesh, vertexCount) == 0, "Mesh.vertexCount");
_Static_assert(offsetof(Mesh, triangleCount) == 4, "Mesh.triangleCount");
_Static_assert(offsetof(Mesh, vertices) == 8, "Mesh.vertices");
_Static_assert(offsetof(Mesh, texcoords) == 12, "Mesh.texcoords");
_Static_assert(offsetof(Mesh, texcoords2) == 16, "Mesh.texcoords2");
_Static_assert(offsetof(Mesh, normals) == 20, "Mesh.normals");
_Static_assert(offsetof(Mesh, tangents) == 24, "Mesh.tangents");
_Static_assert(offsetof(Mesh, colors) == 28, "Mesh.colors");
_Static_assert(offsetof(Mesh, indices) == 32, "Mesh.indices");
_Static_assert(offsetof(Mesh, animVertices) == 36, "Mesh.animVertices");
_Static_assert(offsetof(Mesh, animNormals) == 40, "Mesh.animNormals");
_Static_assert(offsetof(Mesh, boneIds) == 44, "Mesh.boneIds");
_Static_assert(offsetof(Mesh, boneWeights) == 48, "Mesh.boneWeights");
_Static_assert(offsetof(Mesh, boneMatrices) == 52, "Mesh.boneMatrices");
_Static_assert(offsetof(Mesh, boneCount) == 56, "Mesh.boneCount");
_Static_assert(offsetof(Mesh, vaoId) == 60, "Mesh.vaoId");
_Static_assert(offsetof(Mesh, vboId) == 64, "Mesh.vboId");
_Static_assert(sizeof(Mesh) == 68, "sizeof(Mesh)");
_Static_assert(_Alignof(Mesh) == 4, "alignof(Mesh)");

_Static_assert(offsetof(Shader, id) == 0, "Shader.id");
_Static_assert(offsetof(Shader, locs) == 4, "Shader.locs");
_Static_assert(sizeof(Shader) == 8, "sizeof(Shader)");
_Static_assert(_Alignof(Shader) == 4, "alignof(Shader)");

_Static_assert(offsetof(MaterialMap, texture) == 0, "MaterialMap.texture");
_Static_assert(offsetof(MaterialMap, color) == 20, "MaterialMap.color");
_Static_assert(offsetof(MaterialMap, value) == 24, "MaterialMap.value");
_Static_assert(sizeof(MaterialMap) == 28, "sizeof(MaterialMap)");
_Static_assert(_Alignof(MaterialMap) == 4, "alignof(MaterialMap)");

_Static_assert(offsetof(Material, shader) == 0, "Material.shader");
_Static_assert(offsetof(Material, maps) == 8, "Material.maps");
_Static_assert(offsetof(Material, params) == 12, "Material.params");
_Static_assert(sizeof(Material) == 28, "sizeof(Material)");
_Static_assert(_Alignof(Material) == 4, "alignof(Material)");

_Static_assert(offsetof(Transform, translation) == 0, "Transform.translation");
_Static_assert(offsetof(Transform, rotation) == 12, "Transform.rotation");
_Static_assert(offsetof(Transform, scale) == 28, "Transform.scale");
_Static_assert(sizeof(Transform) == 40, "sizeof(Transform)");
_Static_assert(_Alignof(Transform) == 4, "alignof(Transform)");

_Static_assert(offsetof(BoneInfo, name) == 0, "BoneInfo.name");
_Static_assert(offsetof(BoneInfo, parent) == 32, "BoneInfo.parent");
_Static_assert(sizeof(BoneInfo) == 36, "sizeof(BoneInfo)");
_Static_assert(_Alignof(BoneInfo) == 4, "alignof(BoneInfo)");

_Static_assert(offsetof(Model, transform) == 0, "Model.transform");
_Static_assert(offsetof(Model, meshCount) == 64, "Model.meshCount");
_Static_assert(offsetof(Model, materialCount) == 68, "Model.materialCount");
_Static_assert(offsetof(Model, meshes) == 72, "Model.meshes");
_Static_assert(offsetof(Model, materials) == 76, "Model.materials");
_Static_assert(offsetof(Model, meshMaterial) == 80, "Model.meshMaterial");
_Static_assert(offsetof(Model, boneCount) == 84, "Model.boneCount");
_Static_assert(offsetof(Model, bones) == 88, "Model.bones");
_Static_assert(offsetof(Model, bindPose) == 92, "Model.bindPose");
_Static_assert(sizeof(Model) == 96, "sizeof(Model)");
_Static_assert(_Alignof(Model) == 4, "alignof(Model)");

_Static_assert(offsetof(ModelAnimation, boneCount) == 0, "ModelAnimation.boneCount");
_Static_assert(offsetof(ModelAnimation, frameCount) == 4, "ModelAnimation.frameCount");
_Static_assert(offsetof(ModelAnimation, bones) == 8, "ModelAnimation.bones");
_Static_assert(offsetof(ModelAnimation, framePoses) == 12, "ModelAnimation.framePoses");
_Static_assert(offsetof(ModelAnimation, name) == 16, "ModelAnimation.name");
_Static_assert(sizeof(ModelAnimation) == 48, "sizeof(ModelAnimation)");
_Static_assert(_Alignof(ModelAnimation) == 4, "alignof(ModelAnimation)");

_Static_assert(offsetof(GlyphInfo, value) == 0, "GlyphInfo.value");
_Static_assert(offsetof(GlyphInfo, offsetX) == 4, "GlyphInfo.offsetX");
_Static_assert(offsetof(GlyphInfo, offsetY) == 8, "GlyphInfo.offsetY");
_Static_assert(offsetof(GlyphInfo, advanceX) == 12, "GlyphInfo.advanceX");
_Static_assert(offsetof(GlyphInfo, image) == 16, "GlyphInfo.image");
_Static_assert(sizeof(GlyphInfo) == 36, "sizeof(GlyphInfo)");
_Static_assert(_Alignof(GlyphInfo) == 4, "alignof(GlyphInfo)");

_Static_assert(offsetof(Font, baseSize) == 0, "Font.baseSize");
_Static_assert(offsetof(Font, glyphCount) == 4, "Font.glyphCount");
_Static_assert(offsetof(Font, glyphPadding) == 8, "Font.glyphPadding");
_Static_assert(offsetof(Font, texture) == 12, "Font.texture");
_Static_assert(offsetof(Font, recs) == 32, "Font.recs");
_Static_assert(offsetof(Font, glyphs) == 36, "Font.glyphs");
_Static_assert(sizeof(Font) == 40, "sizeof(Font)");
_Static_assert(_Alignof(Font) == 4, "alignof(Font)");

_Static_assert(offsetof(Image, data) == 0, "Image.data");
_Static_assert(offsetof(Image, width) == 4, "Image.width");
_Static_assert(offsetof(Image, height) == 8, "Image.height");
_Static_assert(offsetof(Image, mipmaps) == 12, "Image.mipmaps");
_Static_assert(offsetof(Image, format) == 16, "Image.format");
_Static_assert(sizeof(Image) == 20, "sizeof(Image)");
_Static_assert(_Alignof(Image) == 4, "alignof(Image)");

_Static_assert(offsetof(Texture, id) == 0, "Texture.id");
_Static_assert(offsetof(Texture, width) == 4, "Texture.width");
_Static_assert(offsetof(Texture, height) == 8, "Texture.height");
_Static_assert(offsetof(Texture, mipmaps) == 12, "Texture.mipmaps");
_Static_assert(offsetof(Texture, format) == 16, "Texture.format");
_Static_assert(sizeof(Texture) == 20, "sizeof(Texture)");
_Static_assert(_Alignof(Texture) == 4, "alignof(Texture)");

_Static_assert(offsetof(RenderTexture, id) == 0, "RenderTexture.id");
_Static_assert(offsetof(RenderTexture, texture) == 4, "RenderTexture.texture");
_Static_assert(offsetof(RenderTexture, depth) == 24, "RenderTexture.depth");
_Static_assert(sizeof(RenderTexture) == 44, "sizeof(RenderTexture)");
_Static_assert(_Alignof(RenderTexture) == 4, "alignof(RenderTexture)");

_Static_assert(offsetof(Wave, frameCount) == 0, "Wave.frameCount");
_Static_assert(offsetof(Wave, sampleRate) == 4, "Wave.sampleRate");
_Static_assert(offsetof(Wave, sampleSize) == 8, "Wave.sampleSize");
_Static_assert(offsetof(Wave, channels) == 12, "Wave.channels");
_Static_assert(offsetof(Wave, data) == 16, "Wave.data");
_Static_assert(sizeof(Wave) == 20, "sizeof(Wave)");
_Static_assert(_Alignof(Wave) == 4, "alignof(Wave)");

_Static_assert(offsetof(AudioStream, buffer) == 0, "AudioStream.buffer");
_Static_assert(offsetof(AudioStream, processor) == 4, "AudioStream.processor");
_Static_assert(offsetof(AudioStream, sampleRate) == 8, "AudioStream.sampleRate");
_Static_assert(offsetof(AudioStream, sampleSize) == 12, "AudioStream.sampleSize");
_Static_assert(offsetof(AudioStream, channels) == 16, "AudioStream.channels");
_Static_assert(sizeof(AudioStream) == 20, "sizeof(AudioStream)");
_Static_assert(_Alignof(AudioStream) == 4, "alignof(AudioStream)");

_Static_assert(offsetof(Sound, stream) == 0, "Sound.stream");
_Static_assert(offsetof(Sound, frameCount) == 20, "Sound.frameCount");
_Static_assert(sizeof(Sound) == 24, "sizeof(Sound)");
_Static_assert(_Alignof(Sound) == 4, "alignof(Sound)");

_Static_assert(offsetof(Music, stream) == 0, "Music.stream");
_Static_assert(offsetof(Music, frameCount) == 20, "Music.frameCount");
_Static_assert(offsetof(Music, looping) == 24, "Music.looping");
_Static_assert(offsetof(Music, ctxType) == 28, "Music.ctxType");
_Static_assert(offsetof(Music, ctxData) == 32, "Music.ctxData");
_Static_assert(sizeof(Music) == 36, "sizeof(Music)");
_Static_assert(_Alignof(Music) == 4, "alignof(Music)");

_Static_assert(offsetof(FilePathList, capacity) == 0, "FilePathList.capacity");
_Static_assert(offsetof(FilePathList, count) == 4, "FilePathList.count");
_Static_assert(offsetof(FilePathList, paths) == 8, "FilePathList.paths");
_Static_assert(sizeof(FilePathList) == 12, "sizeof(FilePathList)");
_Static_assert(_Alignof(FilePathList) == 4, "alignof(FilePathList)");

_Static_assert(offsetof(AutomationEvent, frame) == 0, "AutomationEvent.frame");
_Static_assert(offsetof(AutomationEvent, type) == 4, "AutomationEvent.type");
_Static_assert(offsetof(AutomationEvent, params) == 8, "AutomationEvent.params");
_Static_assert(sizeof(AutomationEvent) == 24, "sizeof(AutomationEvent)");
_Static_assert(_Alignof(AutomationEvent) == 4, "alignof(AutomationEvent)");

_Static_assert(offsetof(AutomationEventList, capacity) == 0, "AutomationEventList.capacity");
_Static_assert(offsetof(AutomationEventList, count) == 4, "AutomationEventList.count");
_Static_assert(offsetof(AutomationEventList, events) == 8, "AutomationEventList.events");
_Static_assert(sizeof(AutomationEventList) == 12, "sizeof(AutomationEventList)");
_Static_assert(_Alignof(AutomationEventList) == 4, "alignof(AutomationEventList)");
