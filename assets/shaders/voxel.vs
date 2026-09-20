#version 300 es
precision highp float;
precision highp int;
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec4 vertexColor;
uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matNormal;
out vec3 worldPosition;
out vec3 normal;
out vec4 pigment;
void main() {
    worldPosition = (matModel * vec4(vertexPosition, 1.0)).xyz;
    normal = normalize((matNormal * vec4(vertexNormal, 0.0)).xyz);
    pigment = vertexColor;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
