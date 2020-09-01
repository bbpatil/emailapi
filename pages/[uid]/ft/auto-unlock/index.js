import React, { useState, useEffect } from 'react';
import { withRouter } from 'next/router';
import styled from 'styled-components';
import axios from 'axios';
import Noty from 'noty';
import 'react-responsive-modal/styles.css';
import '~/css/react-responsive-modal-override.css';
import { Modal } from 'react-responsive-modal';

import withAuthUser from '~/components/pageWrappers/withAuthUser';
import withAuthUserInfo from '~/components/pageWrappers/withAuthUserInfo';

import FeatureApp from '~/components/pageWrappers/AppWrapper';
import EmailPreview from '~/components/service-creator/email-preview';
import ConfigOutputBar from '~/components/ft/auto-unlock/config-output-bar';

require('noty/lib/noty.css');
require('noty/lib/themes/relax.css');

const baseUri = (id) => `${process.env.NEXT_PUBLIC_EMAILAPI_DOMAIN}/${id}`;

const Main = styled.main`
  overflow-y: scroll;
`;

const Aside = styled.aside`
  overflow-y: hidden;
`;

function FeatureAutoUnlockApp(props) {
  const {
    isLoading,
    searchInput,
    searchResults,
    selectedSearchResultIndex,
    router,
    serviceIdData,
    isServiceIdFetched,
  } = props;

  const {
    query: { uid, id: serviceId },
  } = router;

  const {
    AuthUserInfo: { token },
  } = props;

  console.log({ isLoading });
  if (isLoading) {
    return <>Loading...</>;
  }

  const [matchedSearchResults, setMatchedSearchResults] = useState([]);
  const [isFirstMatchSelectedOnLoad, setIsFirstMatchSelectedOnLoad] = useState(
    false,
  );

  const [isCreateApiPending, setIsCreateApiPending] = useState(false);
  const [pdfPasswordInput, setPdfPasswordInput] = useState('');
  const [unlockJobAPIProps, setUnlockJobAPIProps] = useState({});
  const [attachmentBase64, setAttachmentBase64] = useState('');
  const [open, setOpen] = useState(false);
  const [testUnlockSuccess, setTestUnlockSuccess] = useState(false);
  const [autoUnlockSettings, setAutoUnlockSettings] = useState({
    past: false,
    future: true,
  });

  function handleChangeAutoUnlockSettings(key, value) {
    setAutoUnlockSettings({
      ...autoUnlockSettings,
      [key]: value,
    });
  }

  async function handleCreateUnlockService() {
    const { data: serviceResponse } = await axios.post(
      `${baseUri(uid)}/services`,
      {
        app: 'AUTO_UNLOCK',
        search_query: searchInput,
        unlock_password: pdfPasswordInput,
        cron: autoUnlockSettings.future,
      },
    );

    if (autoUnlockSettings.past) {
      await axios.post(`/api/apps/auto-unlock`, {
        token,
        uid,
        service_id: serviceResponse._id,
      });
    }
  }

  async function handleCreateUnlockJob() {
    // send attachment id, user id etc
    // test unlock on server and send back an attachment
    try {
      // Step 1: unlockResponse containing `pollQuery` guarantees that email was sent
      const { data: unlockResponse } = await axios.post(
        `/api/email-search/attachment-unlock`,
        {
          ...unlockJobAPIProps,
          token,
          uid,
          pdfPasswordInput,
        },
      );

      // Step 2: email arriving for `from:() subject:()` params matching the ones sent from our backend
      // guarantees that mail sending service (e.g. mailgun) is working as well
      const timer = setInterval(() => {
        async function handle() {
          if (!unlockResponse.pollQuery) {
            clearInterval(timer);
            throw new Error('pollQuery not found!');
          }

          const { data: pollResponse } = await axios({
            method: 'post',
            url: `/api/email-search`,
            data: {
              uid,
              token,
              query: unlockResponse.pollQuery,
            },
          });

          if (
            Array.isArray(pollResponse.emails) &&
            pollResponse.emails.length
          ) {
            setTestUnlockSuccess(true);
            clearInterval(timer);
          }
        }

        handle();
      }, 7000);

      new Noty({
        theme: 'relax',
        text: `✅ Please wait while we unlock and send you an email!`,
      }).show();
    } catch (e) {
      console.log(e);
    }
  }

  async function handleClickAttachmentFilename({
    messageId,
    attachmentId,
    filename,
  }) {
    // set filename in state and pass it to config-output-bar component where user can input password and submit request
    setUnlockJobAPIProps({
      messageId,
      attachmentId,
      filename,
    });

    const { data } = await axios.post(`/api/fetch/attachment`, {
      messageId,
      attachmentId,
      token,
      uid,
    });

    setAttachmentBase64(`data:application/pdf;base64,${data.base64}`);
    setOpen(true);
  }

  return (
    <>
      <Main>
        <EmailPreview
          showPreview={searchResults.length}
          messageItem={
            searchResults.length && selectedSearchResultIndex !== null
              ? searchResults[selectedSearchResultIndex]
              : null
          }
          message={
            searchResults.length && selectedSearchResultIndex !== null
              ? searchResults[selectedSearchResultIndex].message
              : null
          }
          isHtmlContent={
            searchResults.length && selectedSearchResultIndex !== null
              ? searchResults[selectedSearchResultIndex].isHtmlContent
              : null
          }
          selectedSearchResultIndex={selectedSearchResultIndex}
          handleClickAttachmentFilename={handleClickAttachmentFilename}
        />
      </Main>
      <Aside>
        <ConfigOutputBar
          isCreateApiPending={isCreateApiPending}
          searchResults={searchResults}
          matchedSearchResults={matchedSearchResults}
          searchInput={searchInput}
          selectedSearchResultIndex={selectedSearchResultIndex}
          pdfPasswordInput={pdfPasswordInput}
          setPdfPasswordInput={setPdfPasswordInput}
          handleCreateUnlockJob={handleCreateUnlockJob}
          handleCreateUnlockService={handleCreateUnlockService}
          testUnlockSuccess={testUnlockSuccess}
          autoUnlockSettings={autoUnlockSettings}
          handleChangeAutoUnlockSettings={handleChangeAutoUnlockSettings}
        />
      </Aside>
      <Modal open={open} onClose={() => setOpen(false)}>
        <iframe
          src={attachmentBase64}
          title="preview attachment"
          style={{ height: '100vh', width: '1024px' }}
        />
      </Modal>
    </>
  );
}

function AutoUnlockApp({ AuthUserInfo, router }) {
  return (
    <FeatureApp AuthUserInfo={AuthUserInfo}>
      {({
        isLoading,
        setIsLoading,
        searchInput,
        searchResults,
        serviceIdData,
        isServiceIdLoading,
        isServiceIdFetched,
        selectedSearchResultIndex,
        setSelectedSearchResultIndex,
      }) => {
        return (
          <FeatureAutoUnlockApp
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            searchInput={searchInput}
            searchResults={searchResults}
            serviceIdData={serviceIdData}
            isServiceIdLoading={isServiceIdLoading}
            isServiceIdFetched={isServiceIdFetched}
            selectedSearchResultIndex={selectedSearchResultIndex}
            setSelectedSearchResultIndex={setSelectedSearchResultIndex}
            router={router}
            AuthUserInfo={AuthUserInfo}
          />
        );
      }}
    </FeatureApp>
  );
}

export default withAuthUser(withAuthUserInfo(withRouter(AutoUnlockApp)));
