// Google Forms API Service for US&K Family Mart
// Uses Google Workspace OAuth access token obtained via Firebase Auth (GoogleAuthProvider)

export interface FormItem {
  itemId?: string;
  title: string;
  description?: string;
  questionItem?: {
    question: {
      questionId?: string;
      required?: boolean;
      textQuestion?: {
        paragraph?: boolean;
      };
      choiceQuestion?: {
        type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
        options: { value: string }[];
      };
      scaleQuestion?: {
        low: number;
        high: number;
        lowLabel?: string;
        highLabel?: string;
      };
    };
  };
}

export interface GoogleForm {
  formId: string;
  info: {
    title: string;
    documentTitle?: string;
    description?: string;
  };
  responderUri?: string;
  revisionId?: string;
  items?: FormItem[];
}

export interface FormResponseAnswer {
  questionId: string;
  textAnswers?: {
    answers: { value: string }[];
  };
}

export interface FormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, FormResponseAnswer>;
  respondentEmail?: string;
}

export interface DriveFormFile {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

// Search user's Google Drive for all Forms
export const listGoogleForms = async (accessToken: string): Promise<DriveFormFile[]> => {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.form' and trashed = false");
  const fields = encodeURIComponent('files(id, name, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Forms жагсаалт авахад алдаа гарлаа: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
};

// Get specific Google Form details
export const getGoogleForm = async (accessToken: string, formId: string): Promise<GoogleForm> => {
  const url = `https://forms.googleapis.com/v1/forms/${formId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Form мэдээлэл авахад алдаа гарлаа: ${response.status}`);
  }

  return response.json();
};

// Get form responses (submissions)
export const getGoogleFormResponses = async (
  accessToken: string,
  formId: string
): Promise<{ responses: FormResponse[]; totalResponses: number }> => {
  const url = `https://forms.googleapis.com/v1/forms/${formId}/responses`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Формын хариултууд авахад алдаа гарлаа: ${response.status}`);
  }

  const data = await response.json();
  const responses: FormResponse[] = data.responses || [];
  return {
    responses,
    totalResponses: responses.length,
  };
};

// Create a new Google Form
export const createGoogleForm = async (
  accessToken: string,
  title: string,
  documentTitle?: string
): Promise<GoogleForm> => {
  const url = 'https://forms.googleapis.com/v1/forms';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: documentTitle || title,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Шинэ Google Form үүсгэхэд алдаа гарлаа: ${response.status}`);
  }

  return response.json();
};

// Add questions to a form using batchUpdate
export const batchUpdateFormQuestions = async (
  accessToken: string,
  formId: string,
  items: FormItem[],
  description?: string
): Promise<any> => {
  const requests: any[] = [];

  if (description) {
    requests.push({
      updateFormInfo: {
        info: {
          description,
        },
        updateMask: 'description',
      },
    });
  }

  items.forEach((item, index) => {
    requests.push({
      createItem: {
        item,
        location: {
          index,
        },
      },
    });
  });

  const url = `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Формд асуултууд оруулахад алдаа гарлаа: ${response.status}`);
  }

  return response.json();
};

// Template 1: Customer Satisfaction & Store Feedback Form
export const createSatisfactionSurvey = async (accessToken: string): Promise<GoogleForm> => {
  const form = await createGoogleForm(
    accessToken,
    'US&K Family Mart - Хэрэглэгчийн сэтгэл ханамжийн судалгаа',
    'US&K Family Mart Customer Feedback'
  );

  const description =
    'US&K Family Mart-аар үйлчлүүлсэнд баярлалаа! Бид таны санал хүсэлтээр үйлчилгээ, АНУ & БНСУ-аас импортлох барааны нэр төрлийг сайжруулахад туслах болно.';

  const items: FormItem[] = [
    {
      title: 'Манай хүргэлтийн хурд болон үйлчилгээнд ямар үнэлгээ өгөх вэ?',
      description: '1 (Маш муу) - 5 (Маш сайн, түргэн шуурхай)',
      questionItem: {
        question: {
          required: true,
          scaleQuestion: {
            low: 1,
            high: 5,
            lowLabel: 'Сэтгэл дундуур',
            highLabel: 'Маш сайн',
          },
        },
      },
    },
    {
      title: 'Манай барааны чанар болон сав баглаа боодол (Kirkland, Солонгос хүнс гэх мэт):',
      questionItem: {
        question: {
          required: true,
          scaleQuestion: {
            low: 1,
            high: 5,
            lowLabel: 'Таалагдаагүй',
            highLabel: 'Маш их таалагдсан',
          },
        },
      },
    },
    {
      title: 'Та аль ангиллын барааг голчлон худалдан авдаг вэ?',
      questionItem: {
        question: {
          required: false,
          choiceQuestion: {
            type: 'CHECKBOX',
            options: [
              { value: 'АНУ Kirkland / Costco бүтээгдэхүүн' },
              { value: 'БНСУ-ын гоймон, сүмс, кимчи' },
              { value: 'Америк витамин, эрүүл мэндийн нэмэлт' },
              { value: 'Кофе, цай, амттан, чипс' },
              { value: 'Ахуйн цэвэрлэгээ, угаалгын хэрэгсэл' },
            ],
          },
        },
      },
    },
    {
      title: 'Цаашид АНУ эсвэл Солонгосоос ямар бүтээгдэхүүн нэмж импортлуулахыг хүсэж байна вэ?',
      questionItem: {
        question: {
          required: false,
          textQuestion: {
            paragraph: true,
          },
        },
      },
    },
    {
      title: 'Таны нэр эсвэл утасны дугаар (Урамшууллын оноо авах бол заавал бичнэ үү):',
      questionItem: {
        question: {
          required: false,
          textQuestion: {
            paragraph: false,
          },
        },
      },
    },
  ];

  await batchUpdateFormQuestions(accessToken, form.formId, items, description);
  return await getGoogleForm(accessToken, form.formId);
};

// Template 2: Custom Product Import Request Form (АНУ/БНСУ-аас хүссэн бараагаа захиалах форм)
export const createProductRequestForm = async (accessToken: string): Promise<GoogleForm> => {
  const form = await createGoogleForm(
    accessToken,
    'US&K Family Mart - Бараа захиалах & Импортын хүсэлт',
    'US&K Custom Import Request'
  );

  const description =
    'Манай дэлгүүрт байхгүй АНУ-ын Costco/Kirkland эсвэл БНСУ-ын дэлгүүрүүдээс авахыг хүссэн барааны нэр, линкийг бидэнд үлдээгээрэй. Бид дараагийн ачилтаар авчирч өгөх боломжийг судална!';

  const items: FormItem[] = [
    {
      title: 'Хүсэж буй бүтээгдэхүүний нэр болон бренд:',
      description: 'Жишээ нь: Kirkland Signature Calcium 500mg, Shin Ramyun Black 10pk гэх мэт',
      questionItem: {
        question: {
          required: true,
          textQuestion: {
            paragraph: false,
          },
        },
      },
    },
    {
      title: 'Барааны гарал үүсэл (Аль улсаас авах):',
      questionItem: {
        question: {
          required: true,
          choiceQuestion: {
            type: 'RADIO',
            options: [
              { value: 'АНУ (USA / Costco / Amazon)' },
              { value: 'БНСУ (South Korea / E-Mart / Coupang)' },
              { value: 'Ялгаагүй / Аль хямд, боломжтой нь' },
            ],
          },
        },
      },
    },
    {
      title: 'Барааны холбоос (Link) эсвэл тайлбар:',
      questionItem: {
        question: {
          required: false,
          textQuestion: {
            paragraph: true,
          },
        },
      },
    },
    {
      title: 'Хүсэж буй тоо ширхэг болон хүлээгдэж буй үнэ:',
      questionItem: {
        question: {
          required: false,
          textQuestion: {
            paragraph: false,
          },
        },
      },
    },
    {
      title: 'Захиалагчийн холбоо барих утасны дугаар:',
      questionItem: {
        question: {
          required: true,
          textQuestion: {
            paragraph: false,
          },
        },
      },
    },
  ];

  await batchUpdateFormQuestions(accessToken, form.formId, items, description);
  return await getGoogleForm(accessToken, form.formId);
};
