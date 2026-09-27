#version 330
in vec2 fragTexCoord;
uniform sampler2D texture0;
uniform vec2 direction;
uniform int extract,hdr;
out vec4 finalColor;
vec3 sampleLight(vec2 uv){
    vec3 c=texture(texture0,uv).rgb;
    if(extract==0)return c;
    float brightness=max(c.r,max(c.g,c.b));
    float threshold=hdr!=0?1.0:0.7;
    float knee=clamp((brightness-threshold+0.3)/0.6,0.0,1.0);
    return c*max(brightness-threshold,knee*knee*0.3)/max(brightness,0.0001);
}
void main(){
    vec3 c=sampleLight(fragTexCoord)*0.227027;
    c+=(sampleLight(fragTexCoord+direction*1.384615)+sampleLight(fragTexCoord-direction*1.384615))*0.316216;
    c+=(sampleLight(fragTexCoord+direction*3.230769)+sampleLight(fragTexCoord-direction*3.230769))*0.070270;
    finalColor=vec4(c,1.0);
}
