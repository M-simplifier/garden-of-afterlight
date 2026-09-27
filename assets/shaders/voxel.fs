#version 330
in vec3 worldPosition, normal;
in vec4 pigment;
in vec2 surface;
uniform sampler2D shadowMap, shadowFar;
uniform mat4 lightVP, farVP;
uniform vec3 eyePosition, sunDirection, sunRadiance, skyRadiance;
uniform vec3 lightPositions[8];
uniform int lightCount, shadowPass, hasShadows;
uniform float time, night;
out vec4 finalColor;
float shadowAt(sampler2D map, vec3 q, float bias) {
    vec2 pixel = 1.0 / vec2(textureSize(map, 0));
    float total = 0.0;
    for (int x=-1; x<=1; x++) for (int y=-1; y<=1; y++)
        total += step(q.z-bias, texture(map, q.xy + vec2(x,y)*pixel).r);
    return total/9.0;
}
float visibility(vec3 n) {
    if (hasShadows == 0) return 1.0;
    vec3 p = worldPosition + n*0.025;
    vec4 nearP=lightVP*vec4(p,1.0), farP=farVP*vec4(p,1.0);
    vec3 a=nearP.xyz/nearP.w*0.5+0.5, b=farP.xyz/farP.w*0.5+0.5;
    float bias = 0.00006 + 0.00012*(1.0-max(0.0,dot(n,sunDirection)));
    float farLight = 1.0;
    if (all(greaterThan(b,vec3(0.003))) && all(lessThan(b,vec3(0.997)))) farLight=shadowAt(shadowFar,b,bias*2.0);
    float edge=min(min(a.x,1.0-a.x),min(a.y,1.0-a.y));
    if (edge<=0.003 || a.z<=0.0 || a.z>=1.0) return farLight;
    return mix(farLight,shadowAt(shadowMap,a,bias),smoothstep(0.003,0.045,edge));
}
void main() {
    if (shadowPass != 0) { finalColor=vec4(1.0); return; }
    vec3 n=normalize(normal), v=normalize(eyePosition-worldPosition);
    vec3 albedo=pow(max(pigment.rgb,vec3(0.0)),vec3(2.2));
    vec3 cell=floor(worldPosition*18.0);
    uvec3 seed=uvec3(ivec3(cell));uint hash=seed.x*1597334677u^seed.y*3812015801u^seed.z*2798796415u;
    hash^=hash>>16;float grain=float(hash&1023u)/1023.0;
    albedo*=0.95+0.10*grain;
    float metal=1.0-smoothstep(0.01,0.1,abs(surface.y-1.0));
    float water=1.0-smoothstep(0.01,0.1,abs(surface.y-2.0));
    float leaf=1.0-smoothstep(0.01,0.1,abs(surface.y-3.0));
    float ao=clamp(pigment.a,0.0,1.0), lit=visibility(n), nl=max(0.0,dot(n,sunDirection));
    float wrap=0.25+0.75*max(0.0,n.y);
    vec3 ambient=skyRadiance*(0.65+wrap*0.65)*ao;
    ambient+=vec3(0.12,0.15,0.085)*max(0.0,-n.y)*(1.0-night)*ao;
    vec3 color=albedo*(ambient+sunRadiance*nl*lit*(1.0-metal*0.22));
    vec3 h=normalize(v+sunDirection);
    float power=mix(34.0,150.0,metal*0.65+water*0.35);
    vec3 f0=mix(vec3(0.035),albedo,metal*0.8);
    vec3 fresnel=f0+(1.0-f0)*pow(1.0-max(0.0,dot(v,h)),5.0);
    color+=sunRadiance*fresnel*pow(max(0.0,dot(n,h)),power)*lit*nl*1.5;
    color+=albedo*sunRadiance*pow(max(0.0,dot(-n,sunDirection)),2.0)*leaf*0.065*lit;
    if(water>0.1 && n.y>0.5) {
        float ripples=0.5+0.5*sin(worldPosition.x*8.0+time*1.2+sin(worldPosition.z*5.0-time));
        color+=skyRadiance*pow(1.0-max(0.0,dot(n,v)),3.0)*0.45;
        color+=sunRadiance*pow(ripples,24.0)*0.015*lit;
    }
    for(int i=0;i<8;i++) {
        if(i>=lightCount) break;
        vec3 d=lightPositions[i]-worldPosition; float r2=max(0.04,dot(d,d));
        float falloff=pow(max(0.0,1.0-r2/100.0),2.0)/(1.0+r2*0.42);
        color+=albedo*vec3(1.65,1.20,0.53)*falloff*(0.22+0.78*max(0.0,dot(n,d*inversesqrt(r2))))*(0.6+night*1.4);
    }
    color+=albedo*surface.x*(2.5+night*3.5);
    float fog=1.0-exp(-pow(length(worldPosition-eyePosition)*0.0026,1.35));
    vec3 haze=mix(vec3(0.42,0.59,0.66),vec3(0.023,0.045,0.092),night);
    color=mix(color,haze,fog);
    finalColor=vec4(max(color,vec3(0.0)),1.0);
}
