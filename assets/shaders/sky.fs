#version 330
uniform vec2 resolution;
uniform float time,night,lens,viewAspect;
uniform int cloudSteps;
uniform vec3 forwardView,rightView,upView,sunDirection,sunRadiance;
out vec4 finalColor;
// Integer hashing stays stable across desktop GLSL and ANGLE/WebGL precision.
float hash(vec3 p){uvec3 v=uvec3(ivec3(floor(p)));uint h=v.x*1597334677u^v.y*3812015801u^v.z*2798796415u;h^=h>>16;h*=2246822519u;h^=h>>13;return float(h&0x00ffffffu)/16777216.0;}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float density(vec3 p){
 vec2 cell=floor(p.xz*.40);float cloud=-4.;
 for(int x=-1;x<=1;x++)for(int z=-1;z<=1;z++){
  vec2 id=cell+vec2(x,z);float seed=hash(vec3(id,42));
  if(seed<.72)continue;
  vec2 center=(id+vec2(.25+.5*hash(vec3(id,3)),.25+.5*hash(vec3(id,9))))/.40;
  vec3 d=vec3((p.x-center.x)*.80,(p.y-.48)*2.3,(p.z-center.y)*.85);
  float puff=(.65+seed*.35)-length(d);
  puff=max(puff,.61-length(d+vec3(.65,.12,.1)));
  puff=max(puff,.56-length(d-vec3(.58,.08,.23)));
  cloud=max(cloud,puff);
 }
 float detail=(noise(p*5.7)-.5)*.27+(noise(p*12.3)-.5)*.10;
 return max(0.,cloud+detail)*3.8*smoothstep(.02,.17,p.y)*(1.-smoothstep(.85,1.2,p.y));
}
void main(){
 vec2 q=gl_FragCoord.xy/resolution*2.-1.;q.x*=viewAspect;
 vec3 ray=normalize(forwardView+(rightView*q.x+upView*q.y)*lens);
 float elevation=max(.0,ray.y),mu=dot(ray,sunDirection),lowSun=1.-smoothstep(.12,.5,sunDirection.y);
 vec3 day=mix(vec3(.43,.67,.85),vec3(.045,.20,.45),pow(elevation,.47));
 day=mix(day,vec3(.9,.46,.22),lowSun*pow(1.-elevation,4.)*.65);
 vec3 nightSky=mix(vec3(.032,.055,.13),vec3(.003,.009,.029),pow(elevation,.35));
 vec3 color=mix(day,nightSky,night);color+=sunRadiance*(pow(max(0.,mu),24.)*.014+pow(max(0.,mu),240.)*.03);
 float sun=1.-smoothstep(.005,.007,length(ray-sunDirection));color+=sunRadiance*sun*4.;
 if(ray.y>.025 && cloudSteps>0){
  float trans=1.;vec3 cloud=vec3(0);float enter=1.2/ray.y;
  float jitter=hash(vec3(gl_FragCoord.xy,21.));
  for(int i=0;i<24;i++){
   if(i>=cloudSteps)break;
   float t=enter+(float(i)+jitter)*(.068*20./float(cloudSteps))/ray.y;vec3 p=ray*t*1.2+vec3(time*.006,0,time*.002);p.y=t*ray.y-1.2;
   float d=density(p);if(d<.001)continue;float extinction=1.-exp(-d*(.70*20./float(cloudSteps)));
   float shade=exp(-density(p+sunDirection*.20)*3.5-density(p+sunDirection*.45)*1.8);
   vec3 lighting=(vec3(.12,.20,.34)+sunRadiance*.62*pow(shade,1.4))*(1.-night*.94);
   lighting+=sunRadiance*.04*pow(max(0.,mu),8.)*shade;
   cloud+=trans*extinction*lighting;trans*=1.-extinction;
  }
  color=mix(color,color*trans+cloud,smoothstep(.025,.10,ray.y));
 }
 vec2 sc=vec2(atan(ray.z,ray.x),asin(ray.y))*vec2(380,280);vec2 cell=floor(sc),f=fract(sc)-.5;
 float star=step(.996,hash(vec3(cell,17)))*(1.-smoothstep(.01,.13,length(f)))*smoothstep(.02,.22,ray.y);
 color+=vec3(1.8,2.,2.5)*star*night;
 float ribbon=exp(-pow((ray.y-.45-.09*sin(atan(ray.z,ray.x)*3.+time*.015))*20.,2.));color+=vec3(.015,.08,.07)*ribbon*night;
 finalColor=vec4(color,1);
}
