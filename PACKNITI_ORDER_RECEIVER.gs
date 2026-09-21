/**
 * PACKNITI WEBSITE ORDER RECEIVER
 *
 * LIVE ARCHITECTURE:
 * Website → Google Apps Script → Google Sheet → Admin Email
 *
 * WhatsApp is intentionally disabled for now.
 *
 * SETUP:
 * 1. Replace the current Apps Script code with this file.
 * 2. Run setupPackNiti() once.
 * 3. Deploy → Manage deployments → Edit existing deployment.
 * 4. Execute as: Me
 * 5. Who has access: Anyone
 * 6. Deploy.
 *
 * IMPORTANT:
 * - Website POSTs JSON using Content-Type:
 *   text/plain;charset=utf-8
 * - Idempotency protection prevents duplicate orders.
 */

const CONFIG = {
  SPREADSHEET_NAME: 'PackNiti Website Orders',
  ORDERS_SHEET: 'Orders',
  LEADS_SHEET: 'Leads',

  ADMIN_EMAIL: 'packniti@gmail.com',

  // WhatsApp intentionally disabled for now.
  WHATSAPP_ENABLED: false,
  WHATSAPP_ADMIN_NUMBER: '919310706043',
  WHATSAPP_PHONE_NUMBER_ID: '',
  WHATSAPP_ACCESS_TOKEN: '',
  WHATSAPP_TEMPLATE_NAME: '',
  WHATSAPP_TEMPLATE_LANGUAGE: 'en'
};


/**
 * IMPORTANT:
 * Idempotency Key is added at the END so your existing
 * Orders columns are not shifted.
 */
const ORDER_HEADERS = [
  'Created At',
  'Reference',
  'Customer',
  'WhatsApp',
  'Email',
  'Company',
  'Items',
  'Qty',
  'Estimated Amount',
  'Address',
  'GST',
  'Notes',
  'Source',
  'Status',
  'Admin Owner',
  'Last Contacted',
  'Next Follow-up',
  'Admin Notes',
  'Email Status',
  'WhatsApp Status',
  'Idempotency Key'
];


const LEAD_HEADERS = [
  'Created At',
  'Customer',
  'WhatsApp',
  'Email',
  'Company',
  'Requirement',
  'Dimensions',
  'Quantity',
  'Source',
  'Status',
  'Notes',
  'Last Contacted',
  'Next Follow-up',
  'Admin Notes'
];


/**
 * Run ONCE manually from Apps Script.
 *
 * This creates/opens the configured spreadsheet,
 * creates the required sheets and automatically
 * adds any missing headers.
 */
function setupPackNiti() {

  const props = PropertiesService.getScriptProperties();

  let spreadsheetId =
    props.getProperty('PACKNITI_SPREADSHEET_ID');

  let ss;

  if (spreadsheetId) {

    ss = SpreadsheetApp.openById(spreadsheetId);

  } else {

    ss = SpreadsheetApp.create(
      CONFIG.SPREADSHEET_NAME
    );

    props.setProperty(
      'PACKNITI_SPREADSHEET_ID',
      ss.getId()
    );
  }


  const orders =
    getOrCreateSheet_(
      ss,
      CONFIG.ORDERS_SHEET
    );

  ensureHeaders_(
    orders,
    ORDER_HEADERS
  );


  const leads =
    getOrCreateSheet_(
      ss,
      CONFIG.LEADS_SHEET
    );

  ensureHeaders_(
    leads,
    LEAD_HEADERS
  );


  Logger.log(
    'Spreadsheet: ' + ss.getUrl()
  );

  Logger.log(
    'Spreadsheet ID: ' + ss.getId()
  );
}


/**
 * Website order endpoint.
 */
function doPost(e) {

  const started = new Date();

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return json_({
        ok: false,
        error: 'Empty request.'
      });
    }


    const payload =
      JSON.parse(
        e.postData.contents
      );


    // Basic anti-spam honeypot.
    if (payload.website) {

      return json_({
        ok: false,
        error: 'Rejected.'
      });
    }


    const order =
      normalizeOrder_(payload);


    // WhatsApp/mobile is mandatory.
    if (!order.whatsapp) {

      return json_({
        ok: false,
        error:
          'Please enter your WhatsApp number to continue.'
      });
    }


    const ss =
      getSpreadsheet_();


    const sheet =
      ss.getSheetByName(
        CONFIG.ORDERS_SHEET
      );


    if (!sheet) {

      throw new Error(
        'Orders sheet not found. Run setupPackNiti() first.'
      );
    }


    /**
     * =====================================================
     * IDEMPOTENCY PROTECTION
     * =====================================================
     *
     * We check + create the order while holding
     * a script lock.
     *
     * This prevents two identical requests arriving
     * at almost exactly the same time from creating
     * two orders.
     */

    const lock =
      LockService.getScriptLock();

    lock.waitLock(20000);


    try {

      // Make sure the new column exists.
      ensureHeaders_(
        sheet,
        ORDER_HEADERS
      );


      // If the browser supplied an idempotency key,
      // check whether this checkout was already processed.
      if (order.idempotencyKey) {

        const existing =
          findOrderByIdempotencyKey_(
            sheet,
            order.idempotencyKey
          );


        if (existing) {

          return json_({

            ok: true,

            reference:
              existing.reference,

            status:
              existing.status ||
              'ORDER_RECEIVED',

            duplicate: true,

            notification: {

              email:
                existing.emailStatus ||
                'ALREADY_PROCESSED',

              whatsapp:
                existing.whatsappStatus ||
                'NOT_CONFIGURED'
            },

            processingMs:
              new Date() - started
          });
        }
      }


      // Generate the server-side reference.
      const reference =
        createReferenceUnlocked_();


      order.reference =
        reference;

      order.createdAt =
        new Date();

      order.status =
        'NEW';

      order.source =
        order.source || 'Website';


      /**
       * Save the order BEFORE notifications.
       */
      sheet.appendRow([

        order.createdAt,

        order.reference,

        order.customer,

        order.whatsapp,

        order.email,

        order.company,

        order.items,

        order.qty,

        order.estimatedAmount,

        order.address,

        order.gst,

        order.notes,

        order.source,

        order.status,

        '',

        '',

        '',

        '',

        'PENDING',

        CONFIG.WHATSAPP_ENABLED
          ? 'PENDING'
          : 'NOT_CONFIGURED',

        order.idempotencyKey
      ]);


      SpreadsheetApp.flush();


      /**
       * The order now exists permanently.
       *
       * We release the lock before sending notifications.
       * This keeps the sheet operation fast and prevents
       * notification delays from blocking another order.
       */

    } finally {

      lock.releaseLock();
    }


    /**
     * =====================================================
     * NOTIFICATIONS
     * =====================================================
     *
     * Notifications happen AFTER the order is saved.
     *
     * Therefore:
     *
     * Email failure ≠ order failure.
     * WhatsApp failure ≠ order failure.
     */

    const emailStatus =
      sendAdminEmail_(order);


    updateStatusByReference_(
      reference,
      'Email Status',
      emailStatus
    );


    let whatsappStatus =
      'NOT_CONFIGURED';


    if (CONFIG.WHATSAPP_ENABLED) {

      whatsappStatus =
        sendAdminWhatsApp_(order);


      updateStatusByReference_(
        reference,
        'WhatsApp Status',
        whatsappStatus
      );
    }


    /**
     * IMPORTANT:
     *
     * Once we reach here, the order is successfully
     * stored in Google Sheets.
     */

    return json_({

      ok: true,

      reference:
        reference,

      status:
        'ORDER_RECEIVED',

      duplicate:
        false,

      notification: {

        email:
          emailStatus,

        whatsapp:
          whatsappStatus
      },

      processingMs:
        new Date() - started
    });


  } catch (err) {

    console.error(err);


    /**
     * Do NOT expose internal error details
     * through the public website.
     */

    return json_({

      ok: false,

      error:
        'We could not receive the order. Please try again.'
    });
  }
}


/**
 * Health-check endpoint.
 */
function doGet() {

  return json_({

    ok: true,

    service:
      'PackNiti Website Order Receiver',

    status:
      'LIVE'
  });
}


/**
 * Normalize website payload.
 */
function normalizeOrder_(p) {

  const items =
    Array.isArray(p.items)

      ? p.items
          .map(function(item) {

            return [

              item.title ||
              item.name ||
              item.size ||
              '',

              item.size
                ? ' (' + item.size + ')'
                : '',

              item.quantity
                ? ' × ' + item.quantity
                : ''

            ].join('');
          })
          .join(' | ')

      : String(p.items || '');


  const qty =
    p.qty ||
    p.quantity ||
    '';


  return {

    reference: '',

    createdAt: null,

    customer:
      clean_(
        p.customer ||
        p.name ||
        [
          p.firstName,
          p.lastName
        ]
          .filter(Boolean)
          .join(' ')
      ),

    whatsapp:
      cleanPhone_(
        p.whatsapp ||
        p.phone ||
        p.mobile
      ),

    email:
      clean_(p.email),

    company:
      clean_(p.company),

    items:
      clean_(items),

    qty:
      clean_(qty),

    estimatedAmount:
      clean_(
        p.estimatedAmount ||
        p.amount ||
        p.total
      ),

    address:
      clean_(p.address),

    gst:
      clean_(p.gst),

    notes:
      clean_(p.notes),

    source:
      clean_(
        p.source ||
        'Website'
      ),

    status: '',

    /**
     * This comes from checkout.js.
     * It remains the same if the customer retries
     * the same checkout submission.
     */
    idempotencyKey:
      clean_(
        p.idempotencyKey
      )
  };
}


/**
 * Generates the reference.
 *
 * IMPORTANT:
 * This function assumes the caller already
 * holds the script lock.
 */
function createReferenceUnlocked_() {

  const tz =
    Session.getScriptTimeZone() ||
    'Asia/Kolkata';


  const datePart =
    Utilities.formatDate(
      new Date(),
      tz,
      'yyMMdd'
    );


  let code = '';

  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


  for (let i = 0; i < 5; i++) {

    code +=
      chars.charAt(
        Math.floor(
          Math.random() *
          chars.length
        )
      );
  }


  return (
    'PN-' +
    datePart +
    '-' +
    code
  );
}


/**
 * Finds an existing order using the idempotency key.
 */
function findOrderByIdempotencyKey_(
  sheet,
  idempotencyKey
) {

  if (!idempotencyKey) {
    return null;
  }


  const data =
    sheet
      .getDataRange()
      .getValues();


  if (data.length < 2) {
    return null;
  }


  const headers =
    data[0];


  const keyCol =
    headers.indexOf(
      'Idempotency Key'
    );


  const refCol =
    headers.indexOf(
      'Reference'
    );


  const statusCol =
    headers.indexOf(
      'Status'
    );


  const emailCol =
    headers.indexOf(
      'Email Status'
    );


  const whatsappCol =
    headers.indexOf(
      'WhatsApp Status'
    );


  if (
    keyCol === -1 ||
    refCol === -1
  ) {

    return null;
  }


  for (
    let r = 1;
    r < data.length;
    r++
  ) {

    if (
      String(data[r][keyCol]) ===
      String(idempotencyKey)
    ) {

      return {

        reference:
          String(
            data[r][refCol] ||
            ''
          ),

        status:
          statusCol >= 0
            ? String(
                data[r][statusCol] ||
                ''
              )
            : '',

        emailStatus:
          emailCol >= 0
            ? String(
                data[r][emailCol] ||
                ''
              )
            : '',

        whatsappStatus:
          whatsappCol >= 0
            ? String(
                data[r][whatsappCol] ||
                ''
              )
            : ''
      };
    }
  }


  return null;
}


/**
 * Send admin email.
 */
function sendAdminEmail_(order) {

  try {

    const subject =
      'New PackNiti Order — ' +
      order.reference;


    const body =

      'NEW WEBSITE ORDER\n\n' +

      'Reference: ' +
      order.reference +
      '\n\n' +

      'Customer: ' +
      order.customer +
      '\n' +

      'WhatsApp: ' +
      order.whatsapp +
      '\n' +

      'Email: ' +
      order.email +
      '\n' +

      'Company: ' +
      order.company +
      '\n\n' +

      'Items: ' +
      order.items +
      '\n' +

      'Quantity: ' +
      order.qty +
      '\n' +

      'Estimated Amount: ' +
      order.estimatedAmount +
      '\n\n' +

      'Address: ' +
      order.address +
      '\n' +

      'GST: ' +
      order.gst +
      '\n' +

      'Notes: ' +
      order.notes +
      '\n\n' +

      'Source: ' +
      order.source +
      '\n' +

      'Status: NEW\n\n' +

      'Please contact the customer to confirm availability, delivery and shipping charges.';


    MailApp.sendEmail({

      to:
        CONFIG.ADMIN_EMAIL,

      subject:
        subject,

      body:
        body
    });


    return 'SENT';


  } catch (err) {

    console.error(
      'Email error: ' +
      err
    );


    return (
      'FAILED: ' +
      String(err).slice(0, 150)
    );
  }
}


/**
 * WhatsApp Cloud API.
 *
 * Currently disabled.
 *
 * This remains here so WhatsApp can be enabled
 * later without redesigning the backend.
 */
function sendAdminWhatsApp_(order) {

  try {

    const props =
      PropertiesService
        .getScriptProperties();


    const phoneNumberId =
      props.getProperty(
        'WHATSAPP_PHONE_NUMBER_ID'
      ) ||
      CONFIG.WHATSAPP_PHONE_NUMBER_ID;


    const accessToken =
      props.getProperty(
        'WHATSAPP_ACCESS_TOKEN'
      ) ||
      CONFIG.WHATSAPP_ACCESS_TOKEN;


    const templateName =
      props.getProperty(
        'WHATSAPP_TEMPLATE_NAME'
      ) ||
      CONFIG.WHATSAPP_TEMPLATE_NAME;


    const language =
      props.getProperty(
        'WHATSAPP_TEMPLATE_LANGUAGE'
      ) ||
      CONFIG.WHATSAPP_TEMPLATE_LANGUAGE;


    if (
      !phoneNumberId ||
      !accessToken ||
      !templateName
    ) {

      return 'NOT_CONFIGURED';
    }


    const url =
      'https://graph.facebook.com/v23.0/' +
      phoneNumberId +
      '/messages';


    const payload = {

      messaging_product:
        'whatsapp',

      to:
        CONFIG.WHATSAPP_ADMIN_NUMBER,

      type:
        'template',

      template: {

        name:
          templateName,

        language: {
          code:
            language
        },

        components: [

          {

            type:
              'body',

            parameters: [

              {
                type:
                  'text',

                text:
                  order.reference
              },

              {
                type:
                  'text',

                text:
                  order.customer || '-'
              },

              {
                type:
                  'text',

                text:
                  order.whatsapp || '-'
              },

              {
                type:
                  'text',

                text:
                  order.items || '-'
              },

              {
                type:
                  'text',

                text:
                  order.qty || '-'
              },

              {
                type:
                  'text',

                text:
                  order.estimatedAmount || '-'
              }
            ]
          }
        ]
      }
    };


    const response =
      UrlFetchApp.fetch(
        url,
        {

          method:
            'post',

          contentType:
            'application/json',

          headers: {

            Authorization:
              'Bearer ' +
              accessToken
          },

          payload:
            JSON.stringify(
              payload
            ),

          muteHttpExceptions:
            true
        }
      );


    const code =
      response.getResponseCode();


    if (
      code >= 200 &&
      code < 300
    ) {

      return 'SENT';
    }


    return (
      'FAILED HTTP ' +
      code +
      ': ' +
      response
        .getContentText()
        .slice(0, 150)
    );


  } catch (err) {

    console.error(
      'WhatsApp error: ' +
      err
    );


    return (
      'FAILED: ' +
      String(err).slice(0, 150)
    );
  }
}


/**
 * Update a specific status field using
 * the server-generated reference.
 *
 * IMPORTANT:
 * Status updates are secondary to saving the order.
 * If a status update fails, the order must NOT
 * be reported as failed to the website.
 */
function updateStatusByReference_(
  reference,
  columnName,
  value
) {

  try {

    const ss =
      getSpreadsheet_();


    const sheet =
      ss.getSheetByName(
        CONFIG.ORDERS_SHEET
      );


    if (!sheet) {
      return;
    }


    const data =
      sheet
        .getDataRange()
        .getValues();


    if (data.length < 2) {
      return;
    }


    const headers =
      data[0];


    const refCol =
      headers.indexOf(
        'Reference'
      );


    const targetCol =
      headers.indexOf(
        columnName
      );


    if (
      refCol === -1 ||
      targetCol === -1
    ) {

      return;
    }


    for (
      let r = 1;
      r < data.length;
      r++
    ) {

      if (
        String(
          data[r][refCol]
        ) ===
        String(reference)
      ) {

        sheet
          .getRange(
            r + 1,
            targetCol + 1
          )
          .setValue(value);

        return;
      }
    }


  } catch (err) {

    /*
     * IMPORTANT:
     *
     * The order has already been saved.
     * A failure updating Email Status or
     * WhatsApp Status must NEVER turn the
     * successful order into a failed checkout.
     */

    console.error(
      'Status update error: ' +
      err
    );

    return;
  }
}


/**
 * Get configured spreadsheet.
 */
function getSpreadsheet_() {

  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'PACKNITI_SPREADSHEET_ID'
      );


  if (!id) {

    throw new Error(
      'PACKNITI_SPREADSHEET_ID is not configured. Run setupPackNiti().'
    );
  }


  return SpreadsheetApp.openById(id);
}


/**
 * Get existing sheet or create it.
 */
function getOrCreateSheet_(
  ss,
  name
) {

  return (
    ss.getSheetByName(name) ||
    ss.insertSheet(name)
  );
}


/**
 * Create headers on an empty sheet OR
 * add missing headers to an existing sheet.
 *
 * This allows us to upgrade the existing Orders
 * sheet without deleting any existing data.
 */
function ensureHeaders_(
  sheet,
  headers
) {

  if (
    sheet.getLastRow() === 0
  ) {

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

    sheet.setFrozenRows(1);

    return;
  }


  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        Math.max(
          sheet.getLastColumn(),
          1
        )
      )
      .getValues()[0];


  headers.forEach(
    function(header) {

      if (
        existing.indexOf(header) === -1
      ) {

        const newColumn =
          sheet.getLastColumn() + 1;

        sheet
          .getRange(
            1,
            newColumn
          )
          .setValue(header);

        existing.push(header);
      }
    }
  );


  sheet.setFrozenRows(1);
}


/**
 * Clean general text.
 */
function clean_(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';
  }


  return String(value).trim();
}


/**
 * Clean phone number.
 */
function cleanPhone_(value) {

  return clean_(value)
    .replace(
      /[^\d+]/g,
      ''
    );
}


/**
 * Return JSON response.
 */
function json_(obj) {

  return ContentService

    .createTextOutput(
      JSON.stringify(obj)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );
}