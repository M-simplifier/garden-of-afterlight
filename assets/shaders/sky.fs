#version 300 es
precision highp float;
precision highp int;
in vec2 fragTexCoord;
uniform vec2 resolution;
uniform vec3 forwardView;
uniform vec3 rightView;
uniform vec3 upView;
uniform float time;
uniform float veil;
uniform float lens;
out vec4 finalColor;
float hash(vec2 p) {
    uvec2 q=uvec2(ivec2(p));
    uint h=q.x*1597334677u ^ q.y*3812015801u;
    h=(h^(h>>16u))*2246822519u;
    h=(h^(h>>13u))*3266489917u;
    return float(h^(h>>16u))*(1.0/4294967295.0);
}
float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {float f=0.0,a=0.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.03+13.7;a*=0.5;}return f;}
void main() {
    vec2 uv=gl_FragCoord.xy/resolution*2.0-1.0;
    vec3 ray=normalize(forwardView+rightView*uv.x*(resolution.x/resolution.y)*lens+upView*uv.y*lens);
    float elevation=clamp(ray.y*0.8+0.18,0.0,1.0);
    vec3 horizon=mix(vec3(0.77,0.82,0.71),vec3(0.12,0.13,0.23),veil);
    vec3 zenith=mix(vec3(0.10,0.32,0.36),vec3(0.012,0.025,0.067),veil);
    vec3 col=mix(horizon,zenith,pow(elevation,0.55));
    float sun=pow(max(dot(ray,normalize(vec3(-0.55,0.38,0.68))),0.0),48.0);
    col+=mix(vec3(0.50,0.31,0.11),vec3(0.20,0.07,0.19),veil)*sun;
    vec2 cloudUV=ray.xz/(abs(ray.y)+0.19)*1.6+vec2(time*0.0015,0.0);
    float cloud=fbm(cloudUV);
    float bank=smoothstep(0.40,0.74,cloud)*(1.0-smoothstep(-0.2,0.6,ray.y));
    col=mix(col,mix(vec3(0.92,0.89,0.75),vec3(0.17,0.17,0.29),veil),bank*0.82);
    vec2 stars=floor(ray.xz/(ray.y+1.3)*760.0);
    col+=vec3(0.44,0.73,0.78)*step(0.998,hash(stars))*(0.05+veil*0.95)*smoothstep(0.05,0.6,ray.y);
    float ribbon=pow(max(0.0,1.0-abs(ray.y-(0.32+0.10*sin(ray.x*4.0+time*0.03)+0.045*sin(ray.z*9.0)))*12.0),3.0);
    col+=vec3(0.045,0.27,0.24)*ribbon*veil*(0.4+0.6*fbm(ray.xz*8.0+time*0.008));
    finalColor=vec4(col,1.0);
}
