#version 330
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec4 vertexColor;
in vec2 vertexTexCoord;
uniform mat4 mvp, matModel, matNormal;
out vec3 worldPosition, normal;
out vec4 pigment;
out vec2 surface;
void main() {
    worldPosition = (matModel * vec4(vertexPosition, 1.0)).xyz;
    normal = normalize((matNormal * vec4(vertexNormal, 0.0)).xyz);
    pigment = vertexColor; // RGB albedo, alpha local ambient visibility.
    surface = vertexTexCoord; // emission, surface class.
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
