#version 300 es
precision highp float;
precision highp int;
in vec2 fragTexCoord;
uniform sampler2D texture0;
uniform vec2 resolution;
uniform vec3 grading; // Exposure in stops, film palette, bloom enable.
uniform float vignette;
out vec4 finalColor;
vec3 bright(vec2 uv) {vec3 c=texture(texture0,uv).rgb;return c*max(max(c.r,max(c.g,c.b))-0.88,0.0);}
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
    vec3 bloom=bright(uv)*0.15;
    for(int i=1;i<=4;i++) {
        float d=float(i*i)*1.4;
        bloom+=(bright(uv+vec2(d,0)*texel)+bright(uv-vec2(d,0)*texel)+bright(uv+vec2(0,d)*texel)+bright(uv-vec2(0,d)*texel))*0.047;
    }
    color+=bloom*0.72*grading.z;
    color=clamp((color-0.035)*1.08,0.0,1.0);
    color=pow(color,vec3(0.96));
    vec2 p=uv*2.0-1.0;
    color*=exp2(grading.x);
    if(grading.y>2.5) color=vec3(dot(color,vec3(0.2126,0.7152,0.0722)))*vec3(0.94,0.98,1.03);
    else if(grading.y>1.5) color=color*vec3(0.77,0.95,1.18)+vec3(0.015,0.008,0.025);
    else if(grading.y>0.5) color=color*vec3(1.14,1.02,0.83)+vec3(0.016,0.004,0.0);
    color*=1.0-vignette*pow(dot(p,p)*0.5,1.3);
    finalColor=vec4(color,1.0);
}
