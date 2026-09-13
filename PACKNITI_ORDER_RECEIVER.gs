/*
PACKNITI ORDER RECEIVER
Deploy as a Google Apps Script Web App (Execute as you / Anyone).
Set Script Properties:
PACKNITI_ADMIN_EMAIL = packniti@gmail.com
SHEET_ID = your Google Sheet ID
WHATSAPP_TOKEN = optional Meta WhatsApp Cloud API token
WHATSAPP_PHONE_NUMBER_ID = optional Meta WhatsApp phone number ID
WHATSAPP_ADMIN_TO = optional PackNiti admin destination number, digits only

Put the deployed Web App URL into checkout.js -> ORDER_API_URL.
*/
function doPost(e){
  try{
    var o=JSON.parse(e.postData.contents||'{}');
    if(!o.reference) throw new Error('Missing order reference');
    var p=PropertiesService.getScriptProperties();
    var admin=p.getProperty('PACKNITI_ADMIN_EMAIL')||'packniti@gmail.com';
    saveOrder_(o,p.getProperty('SHEET_ID'));
    MailApp.sendEmail(admin,'PackNiti New Order — '+o.reference,orderText_(o,true));
    if(o.email) MailApp.sendEmail(o.email,'PackNiti Order Received — '+o.reference,orderText_(o,false));
    sendWhatsAppAdmin_(o,p);
    return json_({ok:true,reference:o.reference});
  }catch(err){return json_({ok:false,error:String(err)})}
}
function json_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON)}
function saveOrder_(o,id){
  if(!id)return;
  var ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName('Orders')||ss.insertSheet('Orders');
  if(sh.getLastRow()===0)sh.appendRow(['Reference','Created At','Status','Name','Email','Mobile','Company','GSTIN','No GST','Address','City','PIN','State','Billing Same','Notes','Items','Subtotal','Shipping Note']);
  var items=(o.items||[]).map(function(i){var d=i.dimensions||{};return (i.title||'Box')+' | '+(d.length||'')+'×'+(d.breadth||'')+'×'+(d.width||'')+' | Qty '+(i.qty||0)+' | ₹'+(i.price||0)+'/box'}).join('\n');
  sh.appendRow([o.reference,o.createdAt,o.status||'ORDER_RECEIVED',(o.firstName||'')+' '+(o.lastName||''),o.email||'',o.mobile||'',o.company||'',o.gstin||'',o.noGst?'YES':'NO',o.address||'',o.city||'',o.pin||'',o.state||'',o.sameBilling?'YES':'NO',o.notes||'',items,o.subtotal||0,o.shipping_note||'Shipping charges applicable']);
}
function orderText_(o,admin){
  var items=(o.items||[]).map(function(i){var d=i.dimensions||{};return '- '+(i.title||'Box')+' | '+(d.length||'')+' × '+(d.breadth||'')+' × '+(d.width||'')+' in | Qty: '+(i.qty||0)+' | ₹'+(i.price||0)+'/box'}).join('\n');
  return 'PackNiti order reference: '+o.reference+'\n\nCustomer: '+(o.firstName||'')+' '+(o.lastName||'')+'\nEmail: '+(o.email||'Not provided')+'\nMobile: '+(o.mobile||'Not provided')+'\nCompany: '+(o.company||'Not provided')+'\nGSTIN: '+(o.noGst?'No GST number':(o.gstin||'Not provided'))+'\n\nShipping address:\n'+(o.address||'')+', '+(o.city||'')+' - '+(o.pin||'')+', '+(o.state||'')+'\n\nItems:\n'+items+'\n\nSubtotal: ₹'+Math.round(o.subtotal||0).toLocaleString('en-IN')+'\nShipping charges applicable.\nNotes: '+(o.notes||'None')+'\n\n'+(admin?'ACTION: Contact customer to confirm availability, shipping charges and final order details.':'PackNiti will contact you to confirm availability, shipping charges and final order details.');
}
function sendWhatsAppAdmin_(o,p){
  var token=p.getProperty('WHATSAPP_TOKEN'),phoneId=p.getProperty('WHATSAPP_PHONE_NUMBER_ID'),to=p.getProperty('WHATSAPP_ADMIN_TO');
  if(!token||!phoneId||!to)return;
  var body='📦 New PackNiti order\nReference: '+o.reference+'\nCustomer: '+(o.firstName||'')+' '+(o.lastName||'')+'\nMobile: '+(o.mobile||'Not provided')+'\nEmail: '+(o.email||'Not provided')+'\nSubtotal: ₹'+Math.round(o.subtotal||0).toLocaleString('en-IN')+'\nShipping charges applicable.\nPlease contact customer to confirm order.';
  UrlFetchApp.fetch('https://graph.facebook.com/v23.0/'+phoneId+'/messages',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify({messaging_product:'whatsapp',to:to,type:'text',text:{body:body}}),muteHttpExceptions:true});
}
