#version 300 es
precision highp float;
precision highp int;
in vec3 worldPosition;
in vec3 normal;
in vec4 pigment;
uniform vec3 eyePosition;
uniform float veil;
uniform float time;
uniform int lightCount;
uniform vec3 lightPositions[8];
out vec4 finalColor;
void main() {
    vec3 sun = normalize(vec3(-0.55,0.82,-0.35));
    float lambert = max(dot(normal,sun),0.0);
    float up = max(normal.y,0.0);
    vec3 ambient = mix(vec3(0.22,0.34,0.35), vec3(0.12,0.16,0.28),veil);
    vec3 sunlight = mix(vec3(1.02,0.86,0.63),vec3(0.29,0.24,0.45),veil);
    vec3 lit = pigment.rgb*(ambient+sunlight*lambert*0.88+vec3(0.08,0.11,0.09)*up);
    float grain = fract(sin(dot(floor(worldPosition*8.0),vec3(12.9898,78.233,43.21)))*43758.5453);
    lit *= 0.965+grain*0.07;
    lit += pigment.rgb*pigment.a*(0.50+veil*1.35)*(0.91+0.09*sin(time*1.2+worldPosition.y));
    for (int i=0;i<lightCount;i++) {
        vec3 toLight=lightPositions[i]-worldPosition;
        float radius=length(toLight);
        float falloff=pow(max(0.0,1.0-radius/7.0),2.0);
        lit+=pigment.rgb*vec3(0.65,0.91,0.56)*falloff*(0.3+veil*1.5)*
            (0.3+0.7*max(dot(normal,normalize(toLight)),0.0));
    }
    float distanceToEye = length(worldPosition-eyePosition);
    float fog = 1.0-exp(-pow(distanceToEye*0.0048,1.65));
    vec3 fogColor=mix(vec3(0.57,0.71,0.67),vec3(0.075,0.105,0.19),veil);
    lit=mix(lit,fogColor,clamp(fog,0.0,0.92));
    finalColor=vec4(lit,1.0);
}
