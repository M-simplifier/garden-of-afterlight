#version 330
uniform sampler2D sceneDepth,shadowMap,shadowFar;
uniform mat4 invViewProjection,lightVP,farVP;
uniform vec2 resolution,sceneSize,lensAspect,clipPlanes;
uniform int sampleCount,hasShadows;
uniform vec3 eyePosition,sunDirection,sunRadiance;
uniform float night;
out vec4 finalColor;
vec3 position(vec2 p,float d){vec4 w=invViewProjection*vec4(p*2.-1.,d*2.-1.,1);return w.xyz/w.w;}
float hash(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
float lit(vec3 w){
 if(hasShadows==0)return 1.;
 vec4 p=lightVP*vec4(w,1);vec3 q=p.xyz/p.w*.5+.5;
 if(q.x>.01&&q.x<.99&&q.y>.01&&q.y<.99&&q.z<1.)return step(q.z-.00025,texture(shadowMap,q.xy).r);
 p=farVP*vec4(w,1);q=p.xyz/p.w*.5+.5;
 if(q.x>.01&&q.x<.99&&q.y>.01&&q.y<.99&&q.z<1.)return step(q.z-.0003,texture(shadowFar,q.xy).r);
 return 1.;
}
vec3 viewPosition(vec2 uv){
 float d=texture(sceneDepth,uv).r;
 float z=clipPlanes.x*clipPlanes.y/(clipPlanes.y-d*(clipPlanes.y-clipPlanes.x));
 return vec3((uv*2.-1.)*vec2(lensAspect.y,1.)*lensAspect.x,-1.)*z;
}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;float depth=texture(sceneDepth,uv).r;
 vec3 pos=position(uv,min(depth,.99999)),delta=pos-eyePosition;float dist=length(delta);vec3 ray=delta/max(.001,dist);float ao=1.;
 if(depth<.99998&&dist<95.&&sampleCount>0){
  vec2 fullRes=sceneSize;vec2 centerUV=(floor(uv*fullRes)+.5)/fullRes;
  vec3 vp=viewPosition(centerUV);vec2 px=1./fullRes;
  vec3 xr=viewPosition(centerUV+vec2(px.x,0))-vp;
  vec3 xl=vp-viewPosition(centerUV-vec2(px.x,0));
  vec3 yr=viewPosition(centerUV+vec2(0,px.y))-vp;
  vec3 yl=vp-viewPosition(centerUV-vec2(0,px.y));
  vec3 n=cross(length(xr)<length(xl)?xr:xl,length(yr)<length(yl)?yr:yl);n*=inversesqrt(max(dot(n,n),1e-12));if(dot(n,-vp)<0.)n=-n;
  float occlusion=0.;float radius=clamp(.72/max(1.,-vp.z),.0005,.09);
  for(int i=0;i<16;i++){
   if(i>=sampleCount)break;
   float a=float(i)*2.399963;float r=sqrt((float(i)+.5)/float(sampleCount));vec2 off=vec2(cos(a)/lensAspect.y,sin(a))*radius*r;
   vec2 at=clamp(centerUV+off,vec2(.001),vec2(.999));at=(floor(at*fullRes)+.5)/fullRes;
   vec3 d=viewPosition(at)-vp;float l=length(d);
   occlusion+=max(0.,dot(n,d)-.035)/max(.04,l)*(1.-smoothstep(.35,1.75,l));
  }
  ao=clamp(1.-occlusion*(3.04/float(sampleCount)),.48,1.);
 }
 float lengthStep=min(dist,155.)/12.;float jitter=hash(gl_FragCoord.xy);float scatter=0.;
 for(int i=0;i<12;i++){
  if(hasShadows==0)break;
  float t=(float(i)+jitter)*lengthStep;vec3 p=eyePosition+ray*t;
  float density=.00040*exp(-max(0.,p.y-7.)*.040);scatter+=lit(p)*density*lengthStep*exp(-t*.0035);
 }
 float mu=dot(ray,sunDirection);float phase=.25+.35*pow(max(0.,mu),6.);
 finalColor=vec4(sunRadiance*scatter*phase*(1.-night*.65),ao);
}
