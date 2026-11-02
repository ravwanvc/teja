"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useLanguage,LanguageSwitcher} from './language';
import ThemeSwitcher from './theme-switcher';
export default function AuthForm({mode}){
 const {lang}=useLanguage(),t=(u,r)=>lang==='ru'?r:u;
 const [action,A]=useState(mode==='register'?'register':'login'),[step,S]=useState(0),[phone,P]=useState(''),[code,C]=useState(''),[token,T]=useState(''),[config,F]=useState({}),[sms,M]=useState(null),[error,E]=useState(''),[busy,B]=useState(false),[admin,D]=useState(false);
 useEffect(()=>{fetch('/api/auth').then(r=>r.json()).then(F).catch(()=>{});},[]);
 async function post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 async function send(){B(true);E('');try{M(await post('/api/phone',{action:'send',phone:'+998'+phone,purpose:action==='reset'?'reset':'register'}));S(1);}catch(e){E(e.message);}finally{B(false);}}
 async function submit(e){e.preventDefault();B(true);E('');const f=new FormData(e.currentTarget);try{
 if(action==='reset'&&step===0){await send();return;}
 if(action==='reset'&&step===1){const d=await post('/api/phone',{action:'verify',purpose:'reset',phone:'+998'+phone,code});T(d.resetToken);S(2);return;}
 if(action==='register'&&config.smsRequired&&!sms){await send();return;}
 if(action==='reset'&&f.get('password')!==f.get('confirmPassword'))throw Error(t('Parollar mos emas','Пароли не совпадают'));
 const d=await post('/api/auth',{action,phone:'+998'+phone,password:f.get('password'),confirmPassword:f.get('confirmPassword'),name:[f.get('name'),f.get('surname')].filter(Boolean).join(' '),role:f.get('role')||'member',code,resetToken:token});location.assign(d.redirect);
 }catch(e){E(e.message);if(e.message.includes('2FA'))D(true);}finally{B(false);}}
 function change(a){A(a);S(0);M(null);T('');C('');E('');D(false);}
 return <main className="auth-shell"><aside className="auth-story"><Link href="/" className="brand">teja.</Link><span className="eyebrow">{t('YAXSHI OVQAT. YAXSHI ODAT.','ХОРОШАЯ ЕДА. ПОЛЕЗНАЯ ПРИВЫЧКА.')}</span><h1>{t('Har kuni mazali.','Вкусно каждый день.')}<br/>{t('Har kuni tejam.','Выгодно каждый день.')}</h1><p>{t('Yaqiningizdagi yaxshi mahsulotlarni qulay narxda toping.','Находите хорошие продукты рядом по выгодной цене.')}</p><img src="/hero.svg" alt=""/></aside><section className="auth-card"><div className="section-head"><Link href="/">← {t('Takliflar','Предложения')}</Link><div className="header-controls"><LanguageSwitcher/><ThemeSwitcher/></div></div><h2>{action==='reset'?t('Parolni tiklash','Восстановление пароля'):action==='register'?t('Hisob yaratish','Создать аккаунт'):t('Xush kelibsiz!','С возвращением!')}</h2>{action!=='reset'&&<div className="auth-tabs"><button className={action==='login'?'active':'secondary'} onClick={()=>change('login')}>{t('Kirish','Вход')}</button><button className={action==='register'?'active':'secondary'} onClick={()=>change('register')}>{t('Ro‘yxatdan o‘tish','Регистрация')}</button></div>}
 <form onSubmit={submit}>{action==='register'&&<><div className="form-grid"><label>{t('Ism','Имя')}<input name="name" required minLength={2} maxLength={38} autoComplete="given-name"/></label><label>{t('Familiya','Фамилия')}<input name="surname" required minLength={2} maxLength={38} autoComplete="family-name"/></label></div><label>{t('Hisob turi','Тип аккаунта')}<select name="role"><option value="member">{t('Xaridor','Покупатель')}</option><option value="seller">{t('Sotuvchi','Продавец')}</option></select></label></>}
 <label>{t('Telefon raqami','Номер телефона')}<div className="phone-field"><span>+998</span><input type="tel" name="phone" value={phone} disabled={action==='reset'&&step>0} onChange={e=>P(e.target.value.replace(/\D/g,'').slice(0,9))} required pattern="[0-9]{9}" autoComplete="tel-national" placeholder="90 123 45 67"/></div></label>
 {(action!=='reset'||step===2)&&<label>{action==='reset'?t('Yangi parol','Новый пароль'):t('Parol','Пароль')}<input name="password" type="password" minLength={8} maxLength={128} required autoComplete={action==='login'?'current-password':'new-password'}/></label>}
 {action==='reset'&&step===2&&<label>{t('Parolni takrorlang','Повторите пароль')}<input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password"/></label>}
 {((action==='reset'&&step===1)||(action==='register'&&sms)||admin)&&<label>{admin?'2FA':t('SMS kodi','Код SMS')}<input value={code} onChange={e=>C(e.target.value.replace(/\D/g,'').slice(0,6))} required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code"/></label>}
 {sms?.mock&&step<2&&<p className="wallet-notice">{t('Sinov SMS kodi','Тестовый код SMS')}: <b>{sms.mockCode}</b></p>}
 {error&&<p role="alert" className="error-box">{error}</p>}<button className="full" disabled={busy}>{busy?t('Kuting…','Подождите…'):action==='reset'?(step===0?t('SMS yuborish','Отправить SMS'):step===1?t('Kodni tasdiqlash','Подтвердить код'):t('Parolni saqlash','Сохранить пароль')):action==='register'?t('Hisob yaratish','Создать аккаунт'):t('Kirish','Войти')}</button></form>
 <button className="text-button" onClick={()=>change(action==='reset'?'login':'reset')}>{action==='reset'?t('Kirishga qaytish','Вернуться ко входу'):t('Parolni unutdingizmi?','Забыли пароль?')}</button><p className="muted">{t('Davom etish orqali foydalanish shartlariga rozilik bildirasiz.','Продолжая, вы соглашаетесь с условиями использования.')}</p></section></main>;
}
