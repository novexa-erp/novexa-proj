"use client";
import { useState, useEffect } from "react";

/**
 * EmailConfirmationDialog
 * 
 * Reusable confirmation popup for email sending
 * Matches the design from the provided image
 */
export default function EmailConfirmationDialog({ show, onConfirm, onCancel, recipientEmail, documentType = "invoice" }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    }
  }, [show]);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(() => onConfirm(), 200);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => onCancel(), 200);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div
        className={`bg-white rounded-3xl shadow-2xl max-w-2xl w-full transform transition-all duration-300 overflow-hidden ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Header - Blue gradient with icon */}
        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white px-12 py-10">
          <div className="flex items-start gap-5">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-4xl font-extrabold mb-2">Send Email?</h3>
              <p className="text-blue-100 text-lg">Confirm email delivery</p>
            </div>
          </div>
        </div>

        {/* Body - Light gray background */}
        <div className="bg-gray-50 px-12 py-10">
          <div className="mb-8">
            <p className="text-gray-600 text-xl mb-6 leading-relaxed">
              {documentType === "invoice" && "Do you want to email this invoice to the customer?"}
              {documentType === "return" && "Do you want to email this return invoice to the customer?"}
              {documentType === "order" && "Do you want to email this purchase order to the supplier?"}
            </p>
            
            {recipientEmail && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl">
                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-blue-600 font-bold mb-1 uppercase tracking-wide">Recipient</p>
                    <p className="text-lg text-gray-900 font-bold truncate">{recipientEmail}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleCancel}
              className="flex-1 px-8 py-5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg rounded-2xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-300"
            >
              No, Don't Send
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-8 py-5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-lg rounded-2xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
            >
              Yes, Send Email
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
