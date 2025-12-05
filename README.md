# PulseGuard - Health Companion

PulseGuard is a comprehensive, modern health tracking web application designed to help users monitor vital health metrics and medications. It leverages AI to provide personalized health insights.

## Features

*   **Vitals Tracking**: 
    *   **Blood Pressure**: Record Systolic and Diastolic values.
    *   **Blood Sugar**: Log levels with context (Fasting, Post-Prandial, Random).
    *   **SpO2**: Monitor Oxygen Saturation levels.
    *   **Heart Rate**: Track beats per minute (BPM).
*   **Medication Management**: Keep a list of current medications with dosage, frequency, and custom descriptions.
*   **Health History**: View records in a detailed table or visualize trends with interactive charts.
*   **AI Insights**: Uses Google Gemini AI to analyze your recent health records and provide a summary with actionable suggestions.
*   **User Profiles**: Secure authentication and profile management via Firebase.
*   **Dark Mode**: Fully supported dark theme for better visibility in low-light conditions.
*   **Reports**: Export data to text files or print a formatted report directly from the browser.

## Technologies Used

*   **Frontend**: React, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Backend & Auth**: Firebase (Authentication, Firestore)
*   **AI**: Google Gemini API (@google/genai)
*   **Icons**: Lucide React

## Pros

*   **Real-time Data**: Instant syncing across devices using Firestore.
*   **Secure**: Robust authentication ensures private health data remains secure.
*   **User-Friendly**: Clean, responsive interface with easy data entry.
*   **Intelligent**: Goes beyond simple logging by offering AI-driven interpretation of data.
*   **Accessible**: High contrast modes and clear typography.

## Setup

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Set up Firebase and create a `.env` file with your API keys if running locally (though this demo uses a hardcoded config for demonstration).
4.  Run the development server: `npm run dev`

## Deployment

To deploy to Vercel:
1.  Push code to GitHub.
2.  Import project in Vercel.
3.  Ensure Build Command is `vite build` and Output Directory is `dist`.

---
Product of [Cordulatech](https://cordulatech.com/)
