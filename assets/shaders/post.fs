#version 330
in vec2 fragTexCoord;
uniform sampler2D texture0,effectsMap,bloomMap,sceneDepth;
uniform int hasEffects,hasBloom;
uniform vec2 resolution;
uniform vec3 grading = vec3(0.0,0.0,1.0); // Exposure in stops, film palette, bloom enable.
uniform float vignette = 0.12;
out vec4 finalColor;
vec3 antialias(vec2 uv, vec2 pixel) {
    vec3 c=texture(texture0,uv).rgb;
    vec3 nw=texture(texture0,uv+vec2(-1,-1)*pixel).rgb;
    vec3 ne=texture(texture0,uv+vec2(1,-1)*pixel).rgb;
    vec3 sw=texture(texture0,uv+vec2(-1,1)*pixel).rgb;
    vec3 se=texture(texture0,uv+vec2(1,1)*pixel).rgb;
    vec3 luma=vec3(0.299,0.587,0.114);
    float a=dot(nw,luma),b=dot(ne,luma),d=dot(sw,luma),e=dot(se,luma),m=dot(c,luma);
    float lo=min(m,min(min(a,b),min(d,e))),hi=max(m,max(max(a,b),max(d,e)));
    if(hi-lo<max(0.035,hi*0.125)) return c;
    vec2 direction=vec2(-((a+b)-(d+e)),(a+d)-(b+e));
    float reduction=max((a+b+d+e)*0.03125,0.0078125);
    direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+reduction),vec2(-6),vec2(6))*pixel;
    vec3 narrow=0.5*(texture(texture0,uv+direction*(-1.0/6.0)).rgb+texture(texture0,uv+direction*(1.0/6.0)).rgb);
    vec3 wide=narrow*0.5+0.25*(texture(texture0,uv-direction*0.5).rgb+texture(texture0,uv+direction*0.5).rgb);
    float w=dot(wide,luma);
    return w<lo||w>hi?narrow:wide;
}
void main() {
    vec2 uv=fragTexCoord,texel=1.0/resolution;
    vec3 color=antialias(uv,texel);
    if(hasEffects!=0) {
        // Bilateral upsampling avoids bleeding foreground AO onto the sky.
        vec2 size=vec2(textureSize(effectsMap,0));
        vec2 base=(floor(uv*size-0.5)+0.5)/size;
        float center=texture(sceneDepth,uv).r, total=0.0;
        vec4 effect=vec4(0.0);
        for(int x=0;x<2;x++)for(int y=0;y<2;y++) {
            vec2 at=clamp(base+vec2(x,y)/size,0.5/size,1.0-0.5/size);
            float d=texture(sceneDepth,at).r;
            float weight=exp(-abs(d-center)*24000.0)+0.0001;
            effect+=texture(effectsMap,at)*weight;total+=weight;
        }
        effect/=total;
        color=color*effect.a+effect.rgb;
    }
    if(hasBloom!=0) color+=texture(bloomMap,uv).rgb*0.13*grading.z;
    vec2 p=uv*2.0-1.0;
    color*=exp2(grading.x);
    // Tone-map once, after exposure and all linear-light effects.
    color=clamp((color*(2.51*color+0.03))/(color*(2.43*color+0.59)+0.14),0.0,1.0);
    color=mix(color*12.92,1.055*pow(color,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),color));
    if(grading.y>2.5) color=vec3(dot(color,vec3(0.2126,0.7152,0.0722)))*vec3(0.94,0.98,1.03);
    else if(grading.y>1.5) color=color*vec3(0.77,0.95,1.18)+vec3(0.015,0.008,0.025);
    else if(grading.y>0.5) color=color*vec3(1.14,1.02,0.83)+vec3(0.016,0.004,0.0);
    color*=1.0-vignette*pow(dot(p,p)*0.5,1.3);
    finalColor=vec4(color,1.0);
}
