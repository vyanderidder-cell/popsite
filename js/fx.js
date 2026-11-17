import * as THREE from '../lib/three.module.min.js';

/* ============ uniformes partagés (lumières de rue, météo, radar) ============ */
export const NL = (typeof window !== 'undefined' && (window.innerWidth < 820 || window.matchMedia('(pointer: coarse)').matches)) ? 4 : 8;
export const U = {
  uLP: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, -999, 0, 0)) },
  uLC: { value: Array.from({ length: NL }, () => new THREE.Vector3()) },
  uScat: { value: .0075 },
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(.4, .3) },
  uRain: { value: 1 },
  uSnow: { value: 0 },
  uWet: { value: 1 },
  uFlash: { value: 0 },
  uRadar: { value: -999 },
  uRadarA: { value: 0 },
  uScan: { value: 0 },
  uFocus: { value: new THREE.Vector2() }
};
const HASH = `float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,9.3);a*=.5;}return s;}
`;
const SCAT = `vec3 lampScatter(vec3 ro, vec3 rd, float tl){vec3 sc=vec3(0.);for(int i=0;i<${NL};i++){vec3 q=uLP[i].xyz-ro;float b=dot(q,rd);float h2=max(dot(q,q)-b*b,.06);float h=sqrt(h2);float s0=-b,s1=tl-b;float i1=(atan(s1/h)-atan(s0/h))/h;float i2=(s1/(h2+s1*s1)-s0/(h2+s0*s0))/(2.*h2)+i1/(2.*h2);sc+=uLC[i]*(i1*.1+i2*2.2);}return sc;}
vec3 lampNear(vec3 p){vec3 s=vec3(0.);for(int i=0;i<${NL};i++){vec3 d=uLP[i].xyz-p;s+=uLC[i]/(1.+dot(d,d)*.22);}return s;}
`;
const LAMPU = `uniform vec4 uLP[${NL}];uniform vec3 uLC[${NL}];uniform float uScat;`;

/* ---- brouillard de hauteur + diffusion des lampadaires dans tous les matériaux ---- */
export function patchFog() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;varying vec3 vFogWP;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\nvFogDepth=-mvPosition.z;vFogWP=cameraPosition+transpose(mat3(viewMatrix))*mvPosition.xyz;\n#endif';
  C.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor;varying float vFogDepth;varying vec3 vFogWP;uniform float fogDensity;' + LAMPU + '\n' + SCAT + '#endif';
  C.fog_fragment = `#ifdef USE_FOG
  float fd=vFogDepth;float fogF=1.-exp(-fogDensity*fogDensity*fd*fd);
  fogF=max(fogF,(1.-exp(-fd*.0045))*exp(-max(vFogWP.y,0.)*.09)*.34);
  vec3 rdv=vFogWP-cameraPosition;float tlv=length(rdv);rdv/=max(tlv,1e-4);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogF)+lampScatter(cameraPosition,rdv,tlv)*uScat;
#endif`;
}
export function attachShared(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    for (const k in U) sh.uniforms[k] = U[k];
  };
}

/* ---- humidité / neige sur les surfaces (matériaux PBR du kit, sol) ---- */
export function weatherize(mat, opt) {
  opt = opt || {};
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  const grime = opt.grime ? 1 : 0, moss = opt.moss ? 1 : 0;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    for (const k in U) sh.uniforms[k] = U[k];
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWet,uSnow;
float wH(vec2 p){p=fract(p*vec2(127.31,311.73));p+=dot(p,p+34.17);return fract(p.x*p.y);}
float wN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wH(i),wH(i+vec2(1.,0.)),f.x),mix(wH(i+vec2(0.,1.)),wH(i+vec2(1.,1.)),f.x),f.y);}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 wN3 = transpose(mat3(viewMatrix)) * normal;
          float upk = smoothstep(.35, .85, wN3.y);
          #ifdef USE_FOG
          vec3 wp = vFogWP;
          // salissures : pied de façade éclaboussé, coulures sous les rebords, variations de teinte
          float vert = 1. - upk;
          float splash = (1. - smoothstep(.05, 1.1, wp.y)) * .38;
          float runs = smoothstep(.5, .95, wN(vec2((wp.x + wp.z) * 2.6, wp.y * .22))) * .2;
          float blot = (wN(wp.xz * .35 + wp.y * .21) - .5) * .16;
          diffuseColor.rgb *= 1. - ${grime}. * vert * (splash + runs + blot);
          // tuiles : mousse et tuiles plus sombres par endroits
          float mk = wN(wp.xz * .55 + 3.7) * wN(wp.xz * 2.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.55, .62, .45), ${moss}. * smoothstep(.25, .6, mk) * .6);
          diffuseColor.rgb *= 1. - ${moss}. * (wN(wp.xz * 1.7) - .5) * .25;
          #endif
          float snowK = uSnow * upk * ${opt.snow != null ? opt.snow.toFixed(2) : '1.'};
          diffuseColor.rgb *= 1. - .28 * uWet * (1. - snowK);
          roughnessFactor *= mix(1., ${opt.wetR != null ? opt.wetR.toFixed(2) : '.55'}, uWet * (.35 + .65 * upk) * (1. - snowK));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.78, .82, .9), snowK * .92);
          roughnessFactor = mix(roughnessFactor, .75, snowK);
        }`);
  };
  mat.customProgramCacheKey = () => key + '|w' + grime + moss;
}

/* ---- environnement de nuit (reflets doux sur le mouillé, les vitres, le métal) ---- */
export function nightEnvironment(renderer) {
  const s = new THREE.Scene();
  const sph = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vD;void main(){float e=vD.y;
      vec3 c=mix(vec3(.02,.03,.06),vec3(.004,.007,.016),smoothstep(0.,.6,e));
      c+=vec3(.09,.05,.022)*exp(-abs(e)*9.);            // halo orangé de la ville à l'horizon
      c=mix(c,vec3(.012,.011,.012),smoothstep(0.,-.2,e)); // sol sombre
      gl_FragColor=vec4(c,1.);}`
  }));
  s.add(sph);
  // quelques sources chaudes basses (lampadaires, vitrines) pour des reflets vivants
  const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, .9, .42) });
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + .3, r = 16 + (i % 3) * 7, b = new THREE.Mesh(new THREE.SphereGeometry(.7 + (i % 2) * .5, 12, 8), lm); b.position.set(Math.cos(a) * r, 2 + (i % 4) * 1.2, Math.sin(a) * r); s.add(b); }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, .02);
  pm.dispose();
  return rt.texture;
}

/* ---- vitrages : émission par instance ---- */
export function glassMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: .12, metalness: 0, emissive: 0xffffff, emissiveIntensity: 1, side: THREE.DoubleSide });
  m.name = 'glass';
  m.onBeforeCompile = (sh) => {
    for (const k in U) sh.uniforms[k] = U[k];
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance *= vColor;
      #endif`);
  };
  m.customProgramCacheKey = () => 'glass1';
  return m;
}

/* ---- sol : pavés, cours, champs, flaques, ondes de pluie, anneau radar ---- */
export function groundMaterial(maps) {
  const m = new THREE.MeshStandardMaterial({ map: maps.color, normalMap: maps.normal, roughnessMap: maps.rough, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    for (const k in U) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;uniform float uTime,uRain,uSnow,uWet,uRadar,uRadarA,uScan;\n' + HASH +
        'float rdist(float v){float m=mod(v-20.,40.);return min(m,40.-m);}\nfloat puddle;float paved;float yard;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec2 p = vGW.xz; float rr = length(p);
          float road = 1. - smoothstep(3.7, 4.3, min(rdist(p.x), rdist(p.y)));
          float sq = 1. - smoothstep(23.5, 24.5, max(abs(p.x), abs(p.y)));
          sq = max(sq, (smoothstep(63.5, 64.5, p.x) - smoothstep(95.5, 96.5, p.x)) * (smoothstep(23.5, 24.5, p.y) - smoothstep(55.5, 56.5, p.y)));
          paved = max(road, sq) * (1. - smoothstep(205., 222., rr));
          float n1 = fbm(p * .045), n2 = vnoise(p * .9);
          yard = 1. - paved;
          vec3 cob = diffuseColor.rgb * mix(vec3(.62, .58, .55), vec3(.45, .47, .52), n1);
          vec3 dirt = mix(vec3(.12, .1, .075), vec3(.09, .12, .07), smoothstep(.35, .7, n1)) * (.8 + .4 * n2);
          vec3 field = mix(vec3(.06, .085, .05), vec3(.1, .095, .06), smoothstep(.3, .75, fbm(p * .012)));
          vec3 col = mix(dirt, cob, paved);
          col = mix(col, field, smoothstep(212., 245., rr));
          // bordures de trottoir
          float curb = (1. - smoothstep(.0, .18, abs(min(rdist(p.x), rdist(p.y)) - 3.95))) * (1. - sq);
          col = mix(col, vec3(.32, .31, .3), curb * .8);
          puddle = smoothstep(.56, .66, fbm(p * .07 + 3.1)) * (paved * .9 + .25) * uWet;
          diffuseColor.rgb = col * (1. - .55 * puddle);
          float snowK = uSnow * (1. - puddle * .5);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.76, .8, .88), snowK * (.75 + .2 * n2));
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(.95, roughnessFactor, paved), .9, 0.) * mix(1., .55, uWet);
        roughnessFactor = mix(roughnessFactor, .045, puddle);
        roughnessFactor = mix(roughnessFactor, .8, uSnow);`)
      // relief des pavés seulement sur les zones pavées
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * max(paved, .12) * (1. - puddle * .9);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // flaques : normale plate + ondes de gouttes
          vec2 ripple = vec2(0.);
          for (int L = 0; L < 2; L++) {
            vec2 q = vGW.xz * (L == 0 ? 1.7 : 2.6) + float(L) * 7.3;
            vec2 id = floor(q), f = fract(q) - .5;
            float h = hash(id + float(L) * 3.1);
            float t = fract(uTime * (.9 + h * .6) + h * 7.);
            vec2 o = (vec2(hash(id + 1.7), hash(id + 9.2)) - .5) * .5;
            vec2 d = f - o; float r = length(d);
            float w = sin((r - t * .55) * 48.) * (1. - t) * smoothstep(t * .55 + .05, t * .55 - .05, r) * smoothstep(0., .1, r);
            ripple += d / max(r, 1e-3) * w;
          }
          ripple *= uRain * .55;
          vec3 rN = normalize(vec3(ripple.x, 1., ripple.y));
          vec3 rNv = normalize((viewMatrix * vec4(rN, 0.)).xyz);
          normal = normalize(mix(normal, rNv, puddle));
          normal = normalize(mix(normal, rNv, uRain * .25 * paved));
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float rr = length(vGW.xz);
          float ring = exp(-pow((rr - uRadar) / 2.2, 2.)) * uRadarA;
          float trail = smoothstep(uRadar - 60., uRadar, rr) * step(rr, uRadar) * uRadarA * .12;
          float gx = 1. - smoothstep(.0, .12, abs(fract(vGW.x / 8.) - .5) * 8. - 3.85);
          float gz = 1. - smoothstep(.0, .12, abs(fract(vGW.z / 8.) - .5) * 8. - 3.85);
          float grid = max(gx, gz) * trail * 2.;
          totalEmissiveRadiance += vec3(.25, .75, 1.) * (ring * 1.6 + trail * .25 + grid);
        }`);
  };
  m.customProgramCacheKey = () => 'ground1';
  return m;
}

/* ---- ciel : dégradé, nuages, lune, étoiles, éclairs, halos des lampes ---- */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;gl_Position.z=gl_Position.w*.99999;}',
    fragmentShader: `varying vec3 vW;uniform float uTime,uRain,uSnow,uFlash;uniform vec2 uWind;${LAMPU}\n${HASH}${SCAT}
    void main(){vec3 d=normalize(vW-cameraPosition);float e=d.y;
    vec3 col=mix(vec3(.016,.024,.05),vec3(.003,.006,.015),smoothstep(-.02,.5,e));col+=vec3(.01,.016,.03)*exp(-abs(e)*12.)+vec3(.03,.017,.007)*exp(-abs(e)*22.);
    col+=vec3(.06,.08,.14)*uFlash*exp(-abs(e)*4.);
    vec3 M=normalize(vec3(.55,.62,.41));float md=dot(d,M);
    if(e>0.){vec2 sp=d.xz/(e+.3)*42.;vec2 id=floor(sp);vec2 f=fract(sp)-.5;float h=hash(id);vec2 jt=(vec2(hash(id+1.3),hash(id+7.7))-.5)*.6;
      float s=step(.9,h)*smoothstep(.1,.0,length(f+jt));s*=.55+.45*sin(uTime*(.8+h*3.)+h*50.);col+=vec3(.5,.56,.7)*s*smoothstep(.02,.3,e)*(1.-.7*uRain);
      col+=vec3(.8,.84,.9)*smoothstep(.99935,.9996,md)+vec3(.12,.16,.28)*pow(max(md,0.),70.)*.4;
      vec2 uv=d.xz/(e+.12)*1.3+uWind*uTime*.025;float n=fbm(uv);float cover=.42+.3*uRain+.12*uSnow;
      float cl=smoothstep(1.-cover-.12,1.-cover+.3,n)*smoothstep(.0,.14,e);
      vec3 cc=mix(vec3(.008,.011,.02),vec3(.04,.047,.066),n)+vec3(.06,.033,.013)*exp(-e*6.)+vec3(.12,.15,.24)*pow(max(md,0.),24.)*.45+vec3(.45,.52,.8)*uFlash*n;
      col=mix(col,cc,cl*.94);}
    col+=lampScatter(cameraPosition,d,700.)*uScat;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  });
}

/* ---- pluie (traits orientés écran), éclaboussures, neige, feuilles, fumée ---- */
export function rainMesh(NP) {
  const g = new THREE.BufferGeometry(), C = [[0, -1], [0, 1], [1, 1], [0, -1], [1, 1], [1, -1]];
  const aP = new Float32Array(NP * 6 * 4), aS = new Float32Array(NP * 6), pos = new Float32Array(NP * 6 * 3);
  for (let i = 0; i < NP; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); for (let k = 0; k < 6; k++) { aP.set([a, b, c, C[k][0]], (i * 6 + k) * 4); aS[i * 6 + k] = C[k][1]; } }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aP', new THREE.BufferAttribute(aP, 4)); g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uAmt: { value: 1 }, uPx: { value: 800 }, uVP: { value: new THREE.Vector2(1, 1) } }, U),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aP;attribute float aS;uniform float uTime,uAmt,uPx;uniform vec2 uWind,uVP;${LAMPU}\n${HASH}${SCAT}
    varying vec3 vC;varying float vS;const vec3 SZ=vec3(120.,90.,120.);
    vec4 prj(vec3 p){return projectionMatrix*viewMatrix*vec4(p,1.);}
    void main(){vec3 s=aP.xyz;float sp=40.+s.y*22.;vec3 dir=normalize(vec3(uWind.x*.38,-1.,uWind.y*.38));vec3 w=s*SZ+dir*uTime*sp;
    vec3 hd=cameraPosition+mod(w-cameraPosition+SZ*.5,SZ)-SZ*.5;vec3 tl=hd-dir*(1.2+s.x*.9);vec4 ch=prj(hd),ct=prj(tl);vS=aS;
    if(min(ch.w,ct.w)<1.5){gl_Position=vec4(2.,2.,2.,1.);vC=vec3(0.);return;}
    vec4 c=aP.w<.5?ch:ct;vec2 dd=(ct.xy/ct.w-ch.xy/ch.w)*uVP;float l=length(dd);vec2 pp=l>.001?vec2(-dd.y,dd.x)/l:vec2(1.,0.);
    float wpx=clamp(.028*uPx/c.w,.8,2.4);c.xy+=pp*wpx/uVP*aS*c.w;gl_Position=c;
    float sheet=.45+1.2*smoothstep(.35,.8,vnoise(hd.xz*.022-uWind*uTime*.35));
    float fade=smoothstep(2.,8.,c.w)*(1.-smoothstep(60.,110.,c.w));
    vC=(vec3(.42,.5,.68)*.5+lampNear(hd)*.9)*fade*uAmt*(.5+.5*s.z)*sheet*(1.-aP.w*.85)*(1.4/wpx);}`,
    fragmentShader: 'varying vec3 vC;varying float vS;void main(){gl_FragColor=vec4(vC*(1.-abs(vS)*.6),1.);}'
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 10;
  return mesh;
}
function pointsMesh(n, vs, fs, extra, blending) {
  const g = new THREE.BufferGeometry(), aP = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) aP.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(aP, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uAmt: { value: 1 }, uPx: { value: 800 }, uMaxPt: { value: 64 } }, extra || {}, U),
    transparent: true, depthWrite: false, blending: blending || THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aP;uniform float uTime,uAmt,uPx,uMaxPt;uniform vec2 uWind,uFocus;${LAMPU}\n${HASH}${SCAT}
      vec4 prj(vec3 p){return projectionMatrix*viewMatrix*vec4(p,1.);}\n` + vs,
    fragmentShader: fs
  });
  const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 11;
  return mesh;
}
export function splashMesh(n) {
  return pointsMesh(n, `varying vec3 vC;float hh(float x){return fract(sin(x*91.7+.13)*43758.5453);}
  void main(){vec3 s=aP.xyz;float ph=uTime*2.4+s.y*7.;float cyc=floor(ph);float life=fract(ph);
  vec2 off=vec2(hh(s.x*13.+cyc*.71),hh(s.z*17.+cyc*1.37));vec3 p=vec3(uFocus.x+(off.x-.5)*70.,.05,uFocus.y+(off.y-.5)*70.);
  vec4 c=prj(p);gl_Position=c;float vz=max(c.w,1.);gl_PointSize=clamp((.05+life*.24)*uPx/vz,1.,uMaxPt);
  float fade=(1.-smoothstep(80.,150.,vz))*smoothstep(1.,4.,vz);vC=(vec3(.4,.48,.62)*.5+lampNear(p+vec3(0.,1.,0.))*1.1)*(1.-life)*(1.-life)*fade*uAmt;}`,
    'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.6,d)*smoothstep(.2,.65,d)+smoothstep(.35,0.,d)*.4;gl_FragColor=vec4(vC*a,1.);}');
}
export function snowMesh(n) {
  return pointsMesh(n, `varying vec3 vC;const vec3 SZ=vec3(110.,70.,110.);
  void main(){vec3 s=aP.xyz;float sp=2.4+s.y*1.6;vec3 w=s*SZ+vec3(uWind.x*uTime*5.,-uTime*sp,uWind.y*uTime*5.);w.x+=sin(uTime*.9+s.z*40.)*1.1;w.z+=cos(uTime*.7+s.x*40.)*1.1;
  vec3 p=cameraPosition+mod(w-cameraPosition+SZ*.5,SZ)-SZ*.5;vec4 c=prj(p);gl_Position=c;float vz=max(c.w,1.);gl_PointSize=clamp((.2+s.x*.16)*uPx/vz,1.5,uMaxPt);
  float fade=smoothstep(1.5,6.,vz)*(1.-smoothstep(35.,55.,vz));vC=(vec3(.62,.68,.82)*.7+lampNear(p)*.8)*fade*uAmt;}`,
    'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(vC*smoothstep(1.,.2,d),1.);}');
}
export function leafMesh(n) {
  return pointsMesh(n, `varying vec3 vC;varying float vA;
  void main(){vec3 s=aP.xyz;vec2 ctr=uFocus;vec2 w=s.xz*90.+uWind*uTime*(6.+s.y*5.)+vec2(sin(uTime*1.1+s.y*40.),cos(uTime*.9+s.x*40.))*2.;
  vec2 xz=ctr+mod(w-ctr+45.,90.)-45.;float y=.25+s.y*s.y*9.+abs(sin(uTime*1.7+s.x*60.))*1.4*length(uWind);vec3 p=vec3(xz.x,y,xz.y);
  vec4 c=prj(p);gl_Position=c;float vz=max(c.w,1.);float tum=.35+.65*abs(sin(uTime*7.+s.z*80.));gl_PointSize=clamp(.13*tum*uPx/vz,1.,uMaxPt);
  float fade=(1.-smoothstep(70.,130.,vz))*smoothstep(1.,4.,vz);vC=mix(vec3(.16,.09,.04),vec3(.3,.16,.05),s.z)*(.5+lampNear(p)*1.6);vA=fade*uAmt;}`,
    'varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float a=step(abs(q.x)+abs(q.y)*1.6,.5);if(a<.5)discard;gl_FragColor=vec4(vC,vA);}', null, THREE.NormalBlending);
}
export function smokeMesh(chims) {
  const n = chims.length * 7, g = new THREE.BufferGeometry(), aS = new Float32Array(n * 4);
  chims.forEach((cp, i) => { for (let k = 0; k < 7; k++) aS.set([cp[0], cp[1], cp[2], (k + Math.random() * .6) / 7], (i * 7 + k) * 4); });
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uPx: { value: 800 }, uMaxPt: { value: 64 } }, U), transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aS;uniform float uTime,uPx,uMaxPt;uniform vec2 uWind;varying float vA,vL;
    void main(){float life=fract(uTime*.06+aS.w);vec3 p=aS.xyz+vec3(uWind.x*life*20.+sin(uTime*.5+aS.w*40.)*life*1.5,life*13.,uWind.y*life*20.+cos(uTime*.4+aS.w*31.)*life*1.5);
    vec4 c=projectionMatrix*viewMatrix*vec4(p,1.);gl_Position=c;float vz=max(c.w,1.);gl_PointSize=clamp((1.+life*4.5)*uPx/vz,1.,uMaxPt);vA=smoothstep(0.,.12,life)*(1.-life)*.45*exp(-vz*.0012);vL=life;}`,
    fragmentShader: 'varying float vA,vL;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,0.,d);a*=a;gl_FragColor=vec4(mix(vec3(.022,.018,.016),vec3(.012,.015,.022),vL),a*vA);}'
  });
  const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 9;
  return mesh;
}

/* ---- repères lumineux (commerces détectés, poussières) ---- */
export function spriteMesh(maxN) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(maxN * 3), col = new Float32Array(maxN * 4), ph = new Float32Array(maxN);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uPx: { value: 800 }, uMaxPt: { value: 64 } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aCol;attribute float aPh;uniform float uTime,uPx,uMaxPt;uniform vec2 uWind;varying vec3 vCol;
    void main(){vec3 p=position;if(aPh>0.){p.xz=mod(p.xz+uWind*uTime*2.5+330.,660.)-330.;p.x+=sin(uTime*.21+aPh*6.)*4.;p.y+=sin(uTime*.33+aPh*17.)*2.5;p.z+=cos(uTime*.17+aPh*11.)*4.;}
    vec4 c=projectionMatrix*viewMatrix*vec4(p,1.);gl_Position=c;float vz=max(c.w,1.);gl_PointSize=clamp(aCol.a*uPx/vz,1.,uMaxPt);
    vCol=aCol.rgb*exp(-vz*.00095)*(aPh>0.?(.35+.3*sin(uTime*.9+aPh*30.)):1.);}`,
    fragmentShader: 'varying vec3 vCol;void main(){float d=length(gl_PointCoord-.5)*2.;float a=max(1.-d,0.);a=a*a*a+smoothstep(.3,.0,d)*.9;gl_FragColor=vec4(vCol*a,1.);}'
  });
  const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 12;
  return mesh;
}
export function beamMesh(maxN) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxN * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(maxN * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aUV;varying vec3 vUV;void main(){gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);vUV=aUV;}',
    fragmentShader: 'varying vec3 vUV;void main(){float s=1.-abs(vUV.x);float f=s*s*s*pow(1.-vUV.y,1.5);gl_FragColor=vec4(vec3(1.,.64,.24)*f*vUV.z*1.3,1.);}'
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 12;
  return mesh;
}
export function radarWall() {
  const P = [];
  for (let i = 0; i < 96; i++) { const w0 = i / 96 * 6.2832, w1 = (i + 1) / 96 * 6.2832, c0 = Math.cos(w0), s0 = Math.sin(w0), c1 = Math.cos(w1), s1 = Math.sin(w1); P.push(c0, 0, s0, c1, 0, s1, c1, 1, s1, c0, 0, s0, c1, 1, s1, c0, 1, s0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uH: { value: 14 } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'uniform float uRadar,uH;varying float vV;void main(){vec3 p=vec3(position.x*uRadar,position.y*uH,position.z*uRadar);vV=position.y;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
    fragmentShader: 'varying float vV;uniform float uRadarA,uTime;void main(){float a=pow(1.-vV,2.6)*.5+step(.92,fract(vV*9.-uTime*1.6))*(1.-vV)*.25;gl_FragColor=vec4(vec3(.3,.8,1.)*a*uRadarA*.8,1.);}'
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 13;
  return mesh;
}

/* ---- couche écran : rideaux de pluie / flocons proches ---- */
export function screenPrecipShader() {
  return {
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime, uRain: U.uRain, uSnow: U.uSnow, uDPR: { value: 1 }, uWS: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;varying vec2 vUv;uniform float uTime,uRain,uSnow,uDPR,uWS;
    float hs(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}
    float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}
    float rl(vec2 px,float cw,float ch,float sp,float sd,float w,float dens){vec2 q=vec2(px.x/cw,px.y/ch+uTime*sp);vec2 id=floor(q);vec2 f=fract(q);float h=hs(id+sd);float ox=.15+.7*hs(id+sd+3.7);
     return smoothstep(w,0.,abs(f.x-ox)*cw)*smoothstep(0.,.06,f.y)*smoothstep(.75,0.,f.y)*step(1.-dens,h);}
    float sl(vec2 px,float cs,float sp,float sd,float rad){vec2 q=px/cs;q.y+=uTime*sp;q.x+=sin(uTime*.8+q.y*.9+sd)*.3-uTime*uWS*sp*.5;vec2 id=floor(q),f=fract(q);float h=hs(id+sd);vec2 c=vec2(hs(id+sd+1.3),hs(id+sd+5.1))*.6+.2;
     return smoothstep(rad,rad*.25,length((f-c)*cs))*step(.45,h);}
    void main(){vec4 base=texture2D(tDiffuse,vUv);vec2 px=gl_FragCoord.xy/uDPR;vec3 col=vec3(0.);
     if(uRain>.01){vec2 rp=vec2(px.x+px.y*uWS*.32,px.y);float gust=.55+.9*smoothstep(.3,.8,vn(vec2(px.x/520.-uTime*uWS*.35,px.y/700.+uTime*.15)));
      float r=rl(rp,26.,140.,4.6,1.,.9,.5)*.16+rl(rp+vec2(13.,0.),48.,260.,3.3,7.,1.2,.45)*.26+rl(rp+vec2(31.,0.),90.,480.,2.3,13.,1.8,.4)*.38;
      col+=vec3(.6,.68,.85)*r*gust*uRain*.55;}
     if(uSnow>.01){float s=sl(px,34.,.9,2.,1.3)*.45+sl(px+vec2(17.,0.),62.,.62,9.,2.2)*.55+sl(px+vec2(40.,0.),130.,.38,17.,7.)*.16;col+=vec3(.82,.86,.95)*s*uSnow*.6;}
     gl_FragColor=vec4(base.rgb+col,base.a);}`
  };
}

/* ---- balancement des arbres au vent ---- */
export function swayTrees(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    for (const k in U) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;uniform vec2 uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(0.);
        #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
        #endif
        float hk = max(transformed.y - 1.5, 0.) * .045;
        float ph = ip.x * .13 + ip.z * .11;
        float g = .55 + .45 * sin(uTime * 1.3 + ph) + .25 * sin(uTime * 3.1 + ph * 2.);
        transformed.xz += uWind * hk * g * 1.6;
        transformed.x += sin(uTime * 4.7 + ph * 3. + transformed.y) * hk * .06;
      }`);
  };
  mat.customProgramCacheKey = () => 'sway';
}
